import {
  drawAnimeBoss,
  drawAnimeHeroSprite,
  drawAnimeNpc,
  drawCosmicCompanion,
  drawSignatureWorldVfx,
  drawVoidWisp,
  type HeroAnimState,
  type RoleAnimKind,
  type SignatureVfxItem,
  type SignatureVfxKind,
} from './characterArt';
import {
  BOSS_ENCOUNTERS,
  CHEST_ENCOUNTERS,
  NPC_ENCOUNTERS,
  PUZZLE_ENCOUNTERS,
  SPOT_ENCOUNTERS,
  getPlanetById,
  getRelicById,
} from './data';
import { canChallengePlanetBoss, evaluateSpotAccess, getGuardianPower } from './logic';
import type { ExplorationProgress, HeroId, PlanetId, RelicRarity, WorldMovingPlatform } from './types';
import { getPlanetLayout } from './worldMap';

export interface NearbyInteractable {
  kind: 'npc' | 'chest' | 'puzzle' | 'spot' | 'boss' | 'portal' | 'switch' | 'gate' | 'clue' | 'mechanism' | 'activity';
  id: string;
  label: string;
  x: number;
  y: number;
  completed: boolean;
  targetPlanetId?: PlanetId | null;
  rarity?: RelicRarity;
  artKey?: string;
  isSecret?: boolean;
  behindBuilding?: boolean;
  guardWispId?: string;
  guarded?: boolean;
  requiresPlanetRelics?: number;
  missingRelics?: number;
  guardianChallengeHeroId?: HeroId;
  heroId?: HeroId;
  activityId?: string;
  spCost?: number;
  gateMode?: 'switch' | 'code' | 'mechanism';
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface VoidWisp {
  id: string;
  baseX: number;
  x: number;
  y: number;
  range: number;
  speed: number;
  phase: number;
  defeated: boolean;
  guardsSpotId?: string;
}

export interface EngineCallbacks {
  getProgress: () => ExplorationProgress;
  getHeroId: () => HeroId;
  getHeroPortraitUrl?: (heroId: HeroId) => string;
  onInteract: (target: NearbyInteractable) => void;
  onNearbyChange: (target: NearbyInteractable | null) => void;
  onSkillStateChange: (cooldownLeft: number, activeLeft: number) => void;
  onVoidCleared?: (wispId: string, x: number, y: number) => void;
  onPlayerHurt?: (damage: number) => void;
  onRoleSkillTriggered?: (heroId: HeroId, info: { revealedSecretCount: number }) => void;
  onConsumeExploreSp?: (cost: number) => boolean;
  onRecoverExploreSp?: (nodeId: string, amount: number, label: string) => void;
  onZoneEntered?: (zoneKey: string, zoneName: string) => void;
  onSkillBlockedLowSp?: (neededSp: number) => void;
  onSfx?: (kind: string) => void;
}

const GRAVITY = 1280;
const BASE_SPEED = 278;
const BASE_JUMP = 548;
const POOL_SIZE = 96;
const VFX_POOL_SIZE = 24;

export class Exploration2DEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: EngineCallbacks;
  private planetId: PlanetId = 'terra_nusantara';

  private rafId: number | null = null;
  private idleTimerId: number | null = null;
  private lastTs = 0;
  private paused = false;
  private renderedPausedFrame = false;

  // Player physics & 8-state animation timers
  public px = 160;
  public py = 440;
  private vx = 0;
  private vy = 0;
  private facing: 1 | -1 = 1;
  private onGround = true;
  private coyoteTimer = 0;
  private jumpBufferTimer = 0;
  private walkDist = 0;
  private scaleX = 1;
  private scaleY = 1;
  private interactAnimTimer = 0;
  private attackTimer = 0;
  private skillAnimTimer = 0;
  private landSquashTimer = 0;
  private hurtTimer = 0;
  private invulnTimer = 0;
  private celebrateTimer = 0;
  private celebrateColor = '#f7d996';

  // Floating Cosmic Companion follow position
  private companionX = 124;
  private companionY = 384;

  // Patrolling Cultural Void wisps
  private voidWisps: VoidWisp[] = [];

  // Camera & world expansion tracking
  private camX = 0;
  private spNodeCooldowns: Record<string, number> = {};
  private lastZoneKey = '';
  private prevMovingPositions: Record<string, { x: number; y: number }> = {};

  // Guardian active skill timers
  private skillCooldown = 0;
  private skillActive = 0;
  private revealedSecrets = new Set<string>();

  // Input flags
  private held = { left: false, right: false, sprint: false };
  private nearby: NearbyInteractable | null = null;
  private lastReportedNearbyId = '';
  private lastSkillEmit = -1;

  // Zero-GC particle & signature VFX pools
  private particles: Particle[] = [];
  private particleCursor = 0;
  private vfxPool: SignatureVfxItem[] = [];
  private vfxCursor = 0;

  // Cached sky & nebula gradients
  private cachedSkyPlanet: PlanetId | null = null;
  private cachedSkyGrad: CanvasGradient | null = null;
  private cachedNebGrad: CanvasGradient | null = null;

  // Listeners bound for cleanup
  private onKeyDownBound: (e: KeyboardEvent) => void;
  private onKeyUpBound: (e: KeyboardEvent) => void;
  private onBlurBound: () => void;
  private onCanvasClickBound: (e: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas2D context unavailable');
    }
    this.ctx = context;
    this.callbacks = callbacks;

    for (let i = 0; i < POOL_SIZE; i += 1) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 3,
        color: '#f7d996',
      });
    }

    for (let i = 0; i < VFX_POOL_SIZE; i += 1) {
      this.vfxPool.push({
        active: false,
        kind: 'sparxie_spark',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        facing: 1,
        life: 0,
        maxLife: 0.5,
        seed: i * 0.7,
      });
    }

    this.onKeyDownBound = (e) => this.handleKeyDown(e);
    this.onKeyUpBound = (e) => this.handleKeyUp(e);
    this.onBlurBound = () => this.clearInputs();
    this.onCanvasClickBound = (e) => this.handleCanvasClick(e);
  }

  public mount() {
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onBlurBound);
    this.canvas.addEventListener('click', this.onCanvasClickBound);
    this.loadPlanet(this.callbacks.getProgress().activePlanet);
    this.startLoop();
  }

  public unmount() {
    this.stopLoop();
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('blur', this.onBlurBound);
    this.canvas.removeEventListener('click', this.onCanvasClickBound);
    this.clearInputs();
  }

  public setPaused(val: boolean) {
    this.paused = val;
    this.renderedPausedFrame = false;
    if (val) {
      this.clearInputs();
      this.vx = 0;
      this.stopLoop();
      if (!this.renderedPausedFrame) {
        this.renderedPausedFrame = true;
        this.render(performance.now() / 1000);
      }
    } else {
      this.wakeLoop();
    }
  }

  public clearInputs() {
    this.held.left = false;
    this.held.right = false;
    this.held.sprint = false;
    this.jumpBufferTimer = 0;
  }

  public loadPlanet(planetId: PlanetId) {
    this.planetId = planetId;
    const layout = getPlanetLayout(planetId);
    this.px = layout.spawnX;
    this.py = layout.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.onGround = true;
    this.facing = 1;
    this.camX = 0;
    this.attackTimer = 0;
    this.skillAnimTimer = 0;
    this.landSquashTimer = 0;
    this.hurtTimer = 0;
    this.invulnTimer = 0;
    this.interactAnimTimer = 0;
    this.celebrateTimer = 0;
    this.spNodeCooldowns = {};
    this.lastZoneKey = '';
    this.prevMovingPositions = {};
    for (const v of this.vfxPool) v.active = false;
    this.companionX = layout.spawnX - 36;
    this.companionY = layout.spawnY - 58;
    if (layout.monsterSpawns && layout.monsterSpawns.length > 0) {
      this.voidWisps = layout.monsterSpawns.map((m, idx) => ({
        id: m.id,
        baseX: m.x,
        x: m.x,
        y: m.y,
        range: m.range,
        speed: m.speed ?? 1.6,
        phase: m.phase ?? idx * 1.1,
        defeated: false,
        guardsSpotId: m.guardsSpotId,
      }));
    } else {
      this.voidWisps = [
        {
          id: `${planetId}_wisp_1`,
          baseX: Math.round(layout.worldWidth * 0.27),
          x: Math.round(layout.worldWidth * 0.27),
          y: layout.groundY - 28,
          range: 52,
          speed: 1.5,
          phase: 0.2,
          defeated: false,
        },
        {
          id: `${planetId}_wisp_2`,
          baseX: Math.round(layout.worldWidth * 0.53),
          x: Math.round(layout.worldWidth * 0.53),
          y: layout.groundY - 28,
          range: 58,
          speed: 1.8,
          phase: 1.9,
          defeated: false,
        },
        {
          id: `${planetId}_wisp_3`,
          baseX: Math.round(layout.worldWidth * 0.76),
          x: Math.round(layout.worldWidth * 0.76),
          y: layout.groundY - 28,
          range: 48,
          speed: 1.65,
          phase: 3.1,
          defeated: false,
        },
      ];
    }
    this.nearby = null;
    this.lastReportedNearbyId = '';
    this.callbacks.onNearbyChange(null);
    this.renderedPausedFrame = false;
    this.wakeLoop();
  }

  public getDefeatedWispIds(): string[] {
    return this.voidWisps.filter((w) => w.defeated).map((w) => w.id);
  }

  public hasDefeatedWisp(wispId: string): boolean {
    const found = this.voidWisps.find((w) => w.id === wispId);
    return found ? found.defeated : true;
  }

  public setTouchMove(dir: 'left' | 'right', active: boolean) {
    if (this.paused) {
      this.held.left = false;
      this.held.right = false;
      return;
    }
    this.held[dir] = active;
    if (active) this.wakeLoop();
  }

  public triggerJump() {
    if (this.paused) return;
    this.jumpBufferTimer = 0.14;
    this.wakeLoop();
  }

  public releaseJump() {
    if (this.vy < -140) {
      this.vy *= 0.48;
    }
  }

  public triggerAttack() {
    if (this.paused || this.attackTimer > 0.14) return;
    const heroId = this.callbacks.getHeroId();
    const power = getGuardianPower(heroId);
    this.attackTimer = 0.38;
    this.scaleX = 1.1;
    this.scaleY = 0.94;
    this.vx += this.facing * 95;
    this.callbacks.onSfx?.(`atk_${heroId}`);

    const projKind: SignatureVfxKind =
      heroId === 'sparkle'
        ? 'sparkle_mask'
        : heroId === 'sampo'
          ? 'sampo_wind'
          : heroId === 'nihilux'
            ? 'nihilux_card_portal'
            : 'sparxie_spark';
    this.spawnSignatureVfx(
      projKind,
      this.px + this.facing * 24,
      this.py - 34,
      this.facing * 365,
      heroId === 'sparkle' ? -12 : 0,
      this.facing,
      0.46
    );

    // Burst cosmic slash particles in front of player
    const strikeX = this.px + this.facing * 42;
    const strikeY = this.py - 32;
    for (let i = 0; i < 12; i += 1) {
      const ang = (Math.PI * 0.8 * (i / 11) - Math.PI * 0.4) + (this.facing < 0 ? Math.PI : 0);
      this.spawnParticle(
        strikeX,
        strikeY,
        Math.cos(ang) * 145,
        Math.sin(ang) * 125,
        0.34,
        3.6,
        i % 2 === 0 ? power.accentColor : '#ffffff'
      );
    }

    // Check strike against patrolling Cultural Void wisps
    for (const wisp of this.voidWisps) {
      if (wisp.defeated) continue;
      const dx = wisp.x - this.px;
      const dy = wisp.y - (this.py - 28);
      const inFront = dx * this.facing >= -18 && Math.abs(dx) <= 98;
      if (inFront && Math.abs(dy) <= 68) {
        this.defeatWisp(wisp);
      }
    }
    this.wakeLoop();
  }

  private defeatWisp(wisp: VoidWisp) {
    wisp.defeated = true;
    for (let k = 0; k < 16; k += 1) {
      const a = (Math.PI * 2 * k) / 16;
      this.spawnParticle(wisp.x, wisp.y, Math.cos(a) * 120, Math.sin(a) * 120, 0.52, 4, '#c084fc');
    }
    this.callbacks.onVoidCleared?.(wisp.id, wisp.x, wisp.y);
  }

  public triggerHurt(knockDir: 1 | -1 = -1, damage = 10) {
    if (this.paused || this.invulnTimer > 0) return;
    this.hurtTimer = 0.52;
    this.invulnTimer = 1.4;
    this.vx = knockDir * 195;
    this.vy = Math.min(this.vy, -210);
    this.onGround = false;
    this.callbacks.onSfx?.('hurt');
    for (let i = 0; i < 12; i += 1) {
      const ang = (Math.PI * 2 * i) / 12;
      this.spawnParticle(this.px, this.py - 32, Math.cos(ang) * 105, Math.sin(ang) * 105, 0.44, 3.6, '#fb7185');
    }
    this.callbacks.onPlayerHurt?.(damage);
    this.wakeLoop();
  }

  public triggerInteract() {
    if (this.paused) return;
    if (this.nearby) {
      this.interactAnimTimer = 0.48;
      this.scaleX = 0.92;
      this.scaleY = 1.09;
      for (let i = 0; i < 10; i += 1) {
        const ang = (Math.PI * 2 * i) / 10;
        this.spawnParticle(
          this.nearby.x,
          this.nearby.y - 26,
          Math.cos(ang) * 75,
          Math.sin(ang) * 75 - 20,
          0.42,
          3.4,
          '#f7d996'
        );
      }
      this.wakeLoop();
      this.callbacks.onInteract(this.nearby);
    }
  }

  public triggerCelebration(accentColor = '#f7d996') {
    this.celebrateTimer = 1.2;
    this.celebrateColor = accentColor;
    for (let i = 0; i < 24; i += 1) {
      const ang = (Math.PI * 2 * i) / 24;
      const spd = 65 + (i % 4) * 32;
      this.spawnParticle(
        this.px,
        this.py - 38,
        Math.cos(ang) * spd,
        Math.sin(ang) * spd - 45,
        0.78,
        4.2,
        i % 2 === 0 ? accentColor : '#fde68a'
      );
    }
    this.wakeLoop();
  }

  public triggerGuardianSkill() {
    if (this.paused || this.skillCooldown > 0) return false;
    const spCost = 15;
    if (this.callbacks.onConsumeExploreSp && !this.callbacks.onConsumeExploreSp(spCost)) {
      this.callbacks.onSfx?.('puzzle_fail');
      this.callbacks.onSkillBlockedLowSp?.(spCost);
      return false;
    }

    const heroId = this.callbacks.getHeroId();
    const power = getGuardianPower(heroId);
    const layout = getPlanetLayout(this.planetId);
    this.skillCooldown = power.cooldownSec;
    this.skillActive = power.durationSec;
    this.interactAnimTimer = 0.45;
    this.skillAnimTimer = 0.55;
    this.callbacks.onSfx?.(`skill_${heroId}`);

    const skillKind: SignatureVfxKind =
      heroId === 'sparkle'
        ? 'sparkle_stage'
        : heroId === 'sampo'
          ? 'sampo_cyclone'
          : heroId === 'nihilux'
            ? 'nihilux_rift'
            : 'sparxie_firework';
    this.spawnSignatureVfx(
      skillKind,
      this.px + (heroId === 'nihilux' ? this.facing * 26 : 0),
      this.py - (heroId === 'sparxie' ? 68 : 34),
      0,
      0,
      this.facing,
      0.95
    );

    let newlyRevealed = 0;
    if (heroId === 'sparkle' || heroId === 'sampo') {
      for (const sec of layout.secretZones) {
        if (!this.revealedSecrets.has(sec.id)) {
          this.revealedSecrets.add(sec.id);
          newlyRevealed += 1;
        }
      }
      if (newlyRevealed > 0) {
        this.callbacks.onSfx?.('secret');
      }
    }

    for (let i = 0; i < 20; i += 1) {
      const ang = (Math.PI * 2 * i) / 20;
      this.spawnParticle(
        this.px,
        this.py - 34,
        Math.cos(ang) * 155,
        Math.sin(ang) * 155,
        0.6,
        4.6,
        power.accentColor
      );
    }
    this.callbacks.onSkillStateChange(this.skillCooldown, this.skillActive);
    this.callbacks.onRoleSkillTriggered?.(heroId, { revealedSecretCount: newlyRevealed });
    this.wakeLoop();
    return true;
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (this.paused) return;
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
      this.held.left = true;
      this.wakeLoop();
    } else if (key === 'arrowright' || key === 'd') {
      this.held.right = true;
      this.wakeLoop();
    } else if (key === 'shift') {
      this.held.sprint = true;
      this.wakeLoop();
    } else if (key === ' ' || key === 'arrowup' || key === 'w') {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag !== 'BUTTON' && tag !== 'INPUT') {
        e.preventDefault();
      }
      if (!e.repeat) this.triggerJump();
    } else if (key === 'x' || key === 'j') {
      if (!e.repeat) this.triggerAttack();
    } else if (key === 'e') {
      if (!e.repeat) this.triggerInteract();
    } else if (key === 'f') {
      if (!e.repeat) this.triggerGuardianSkill();
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
      this.held.left = false;
    } else if (key === 'arrowright' || key === 'd') {
      this.held.right = false;
    } else if (key === 'shift') {
      this.held.sprint = false;
    } else if (key === ' ' || key === 'arrowup' || key === 'w') {
      this.releaseJump();
    }
  }

  private handleCanvasClick(e: MouseEvent) {
    if (this.paused) return;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const worldX = (e.clientX - rect.left) * scaleX + this.camX;
    const worldY = (e.clientY - rect.top) * scaleY;

    const items = this.getPlanetInteractables();
    let best: NearbyInteractable | null = null;
    let bestD = 70;
    for (const item of items) {
      const d = Math.hypot(item.x - worldX, item.y - 26 - worldY);
      if (d < bestD) {
        bestD = d;
        best = item;
      }
    }
    if (best && Math.hypot(best.x - this.px, best.y - this.py) <= 135) {
      this.nearby = best;
      this.triggerInteract();
    } else if (this.nearby && Math.hypot(this.nearby.x - worldX, this.nearby.y - 24 - worldY) < 95) {
      this.triggerInteract();
    }
  }

  private wakeLoop() {
    if (this.paused) return;
    if (this.idleTimerId !== null) {
      window.clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }
    this.startLoop();
  }

  private startLoop() {
    if (this.rafId !== null) return;
    this.lastTs = performance.now();
    const tick = (now: number) => {
      this.rafId = null;
      const rawDt = Math.max(0, (now - this.lastTs) / 1000);
      this.lastTs = now;
      const dt = Math.min(rawDt, 0.05);
      if (!this.paused) {
        this.renderedPausedFrame = false;
        this.update(dt, now / 1000);
        this.render(now / 1000);
        const layout = getPlanetLayout(this.planetId);
        const fastMotion =
          this.held.left ||
          this.held.right ||
          Math.abs(this.vx) > 2 ||
          Math.abs(this.vy) > 2 ||
          this.interactAnimTimer > 0 ||
          this.attackTimer > 0 ||
          this.skillAnimTimer > 0 ||
          this.landSquashTimer > 0 ||
          this.hurtTimer > 0 ||
          this.celebrateTimer > 0 ||
          this.particles.some((p) => p.active) ||
          this.vfxPool.some((v) => v.active) ||
          Math.abs(this.scaleX - 1) > 0.01;
        if (fastMotion) {
          this.rafId = window.requestAnimationFrame(tick);
        } else {
          const hasMoving = (layout.movingPlatforms?.length ?? 0) > 0;
          const delay = this.skillActive > 0 ? 55 : hasMoving ? 50 : 110;
          this.idleTimerId = window.setTimeout(() => {
            this.idleTimerId = null;
            if (!this.paused && this.rafId === null) {
              this.rafId = window.requestAnimationFrame(tick);
            }
          }, delay);
        }
      } else if (!this.renderedPausedFrame) {
        this.renderedPausedFrame = true;
        this.render(now / 1000);
      }
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private stopLoop() {
    if (this.idleTimerId !== null) {
      window.clearTimeout(this.idleTimerId);
      this.idleTimerId = null;
    }
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private spawnParticle(x: number, y: number, vx: number, vy: number, maxLife: number, size: number, color: string) {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % POOL_SIZE;
    p.active = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = maxLife;
    p.maxLife = maxLife;
    p.size = size;
    p.color = color;
  }

  private spawnSignatureVfx(
    kind: SignatureVfxKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    facing: 1 | -1,
    maxLife: number
  ) {
    const v = this.vfxPool[this.vfxCursor];
    this.vfxCursor = (this.vfxCursor + 1) % VFX_POOL_SIZE;
    v.active = true;
    v.kind = kind;
    v.x = x;
    v.y = y;
    v.vx = vx;
    v.vy = vy;
    v.facing = facing;
    v.life = maxLife;
    v.maxLife = maxLife;
  }

  private getMovingPlatformRect(mp: WorldMovingPlatform, timeSec: number) {
    const phase = timeSec * mp.speed + (mp.phaseOffset || 0);
    const delta = Math.sin(phase) * mp.range;
    return {
      x: mp.x + (mp.moveAxis === 'x' ? delta : 0),
      y: mp.y + (mp.moveAxis === 'y' ? delta : 0),
      w: mp.w,
      h: mp.h,
    };
  }

  private getPlanetInteractables(): NearbyInteractable[] {
    const prog = this.callbacks.getProgress();
    const layout = getPlanetLayout(this.planetId);
    const out: NearbyInteractable[] = [];
    for (const npc of NPC_ENCOUNTERS) {
      if (npc.planetId === this.planetId) {
        out.push({
          kind: 'npc',
          id: npc.id,
          label: `${npc.name} (${npc.role})`,
          x: npc.x,
          y: npc.y,
          completed: prog.solvedNpcs.includes(npc.id),
        });
      }
    }
    for (const chest of CHEST_ENCOUNTERS) {
      if (chest.planetId === this.planetId) {
        out.push({
          kind: 'chest',
          id: chest.id,
          label: chest.label,
          x: chest.x,
          y: chest.y,
          completed: prog.openedChests.includes(chest.id),
        });
      }
    }
    for (const puzzle of PUZZLE_ENCOUNTERS) {
      if (puzzle.planetId === this.planetId) {
        out.push({
          kind: 'puzzle',
          id: puzzle.id,
          label: puzzle.title,
          x: puzzle.x,
          y: puzzle.y,
          completed: prog.solvedPuzzles.includes(puzzle.id),
        });
      }
    }
    const defeatedWispIds = this.getDefeatedWispIds();
    for (const spot of SPOT_ENCOUNTERS) {
      if (spot.planetId === this.planetId) {
        const relic = getRelicById(spot.rewardRelicId);
        const access = evaluateSpotAccess(spot, prog, defeatedWispIds);
        out.push({
          kind: 'spot',
          id: spot.id,
          label: spot.label,
          x: spot.x,
          y: spot.y,
          completed: prog.inspectedSpots.includes(spot.id),
          rarity: relic?.rarity,
          artKey: relic?.artKey,
          isSecret: spot.isSecret,
          behindBuilding: spot.behindBuilding,
          guardWispId: spot.guardWispId,
          guarded: access.reason === 'guarded',
          requiresPlanetRelics: spot.requiresPlanetRelics,
          missingRelics: access.missingRelics,
          guardianChallengeHeroId: spot.guardianChallengeHeroId,
        });
      }
    }
    const boss = BOSS_ENCOUNTERS[this.planetId];
    if (boss) {
      out.push({
        kind: 'boss',
        id: boss.id,
        label: `${boss.name} · Penjaga Planet`,
        x: boss.x,
        y: boss.y,
        completed: prog.defeatedBosses.includes(boss.id),
      });
    }
    for (const sw of layout.switches || []) {
      out.push({
        kind: 'switch',
        id: sw.id,
        label: sw.label,
        x: sw.x,
        y: sw.y,
        completed: (prog.activatedSwitches || []).includes(sw.id),
      });
    }
    for (const gate of layout.gates || []) {
      if (gate.mode === 'code') {
        out.push({
          kind: 'gate',
          id: gate.id,
          label: gate.label,
          x: gate.x + gate.w / 2,
          y: gate.y,
          completed: (prog.unlockedGates || []).includes(gate.id),
          gateMode: gate.mode,
        });
      }
    }
    for (const cl of layout.clueObjects || []) {
      out.push({
        kind: 'clue',
        id: cl.id,
        label: cl.title,
        x: cl.x,
        y: cl.y,
        completed: (prog.readClues || []).includes(cl.id),
      });
    }
    for (const mech of layout.mechanisms || []) {
      out.push({
        kind: 'mechanism',
        id: mech.id,
        label: mech.title,
        x: mech.x,
        y: mech.y,
        completed: (prog.activatedMechanisms || []).includes(mech.id),
        heroId: mech.heroId,
        spCost: mech.spCost,
      });
    }
    for (const act of layout.activitySpots || []) {
      out.push({
        kind: 'activity',
        id: act.id,
        label: act.label,
        x: act.x,
        y: act.y,
        completed: (prog.solvedActivities || []).includes(act.activityId),
        activityId: act.activityId,
      });
    }
    if (layout.portal) {
      const target = layout.portal.targetPlanetId;
      const unlocked = !target || prog.unlockedPlanets.includes(target);
      out.push({
        kind: 'portal',
        id: `portal_${this.planetId}`,
        label: unlocked ? layout.portal.label : `${layout.portal.label} (Terkunci)`,
        x: layout.portal.x,
        y: layout.portal.y,
        completed: unlocked,
        targetPlanetId: target,
      });
    }
    return out;
  }

  private update(dt: number, timeSec = 0) {
    const layout = getPlanetLayout(this.planetId);
    const prog = this.callbacks.getProgress();
    const heroId = this.callbacks.getHeroId();
    const power = getGuardianPower(heroId);

    if (this.skillCooldown > 0) this.skillCooldown = Math.max(0, this.skillCooldown - dt);
    if (this.skillActive > 0) this.skillActive = Math.max(0, this.skillActive - dt);
    if (this.interactAnimTimer > 0) this.interactAnimTimer = Math.max(0, this.interactAnimTimer - dt);
    if (this.attackTimer > 0) this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.skillAnimTimer > 0) this.skillAnimTimer = Math.max(0, this.skillAnimTimer - dt);
    if (this.landSquashTimer > 0) this.landSquashTimer = Math.max(0, this.landSquashTimer - dt);
    if (this.hurtTimer > 0) this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.celebrateTimer > 0) this.celebrateTimer = Math.max(0, this.celebrateTimer - dt);

    for (const nodeId of Object.keys(this.spNodeCooldowns)) {
      if (this.spNodeCooldowns[nodeId] > 0) {
        this.spNodeCooldowns[nodeId] = Math.max(0, this.spNodeCooldowns[nodeId] - dt);
      }
    }

    const skillKey = Math.ceil(this.skillCooldown) * 100 + Math.ceil(this.skillActive);
    if (skillKey !== this.lastSkillEmit) {
      this.lastSkillEmit = skillKey;
      this.callbacks.onSkillStateChange(this.skillCooldown, this.skillActive);
    }

    // Moving platform delta carry
    const movingRects: { id: string; x: number; y: number; w: number; h: number }[] = [];
    for (const mp of layout.movingPlatforms || []) {
      const rect = this.getMovingPlatformRect(mp, timeSec);
      const prev = this.prevMovingPositions[mp.id];
      if (prev && this.onGround && this.vy >= 0) {
        const onTop =
          this.px >= prev.x - 10 &&
          this.px <= prev.x + mp.w + 10 &&
          Math.abs(this.py - prev.y) <= 7;
        if (onTop) {
          this.px += rect.x - prev.x;
          this.py += rect.y - prev.y;
        }
      }
      this.prevMovingPositions[mp.id] = { x: rect.x, y: rect.y };
      movingRects.push({ id: mp.id, ...rect });
    }

    const dir = this.hurtTimer > 0.18 ? 0 : (this.held.right ? 1 : 0) - (this.held.left ? 1 : 0);
    const activeBoost = this.skillActive > 0 && heroId === 'sampo' ? 1.15 : 1;
    const sprintMult = this.held.sprint ? 1.28 : 1;
    const targetVx = dir * BASE_SPEED * power.speedBonus * activeBoost * sprintMult;
    this.vx += (targetVx - this.vx) * Math.min(1, dt * 14);
    if (Math.abs(dir) > 0) {
      this.facing = dir > 0 ? 1 : -1;
    }

    const prevX = this.px;
    const prevY = this.py;
    this.px += this.vx * dt;
    this.px = Math.max(36, Math.min(layout.worldWidth - 36, this.px));

    const playerHalfW = 16;
    for (const obs of layout.obstacles) {
      if (this.py > obs.y + 6 && this.py - 56 < obs.y + obs.h) {
        if (this.px + playerHalfW > obs.x && prevX + playerHalfW <= obs.x + 6) {
          this.px = obs.x - playerHalfW;
          this.vx = 0;
        } else if (this.px - playerHalfW < obs.x + obs.w && prevX - playerHalfW >= obs.x + obs.w - 6) {
          this.px = obs.x + obs.w + playerHalfW;
          this.vx = 0;
        }
      }
    }

    if (this.onGround && Math.abs(this.vx) > 35) {
      this.walkDist += Math.abs(this.vx) * dt;
      if (this.walkDist > 42) {
        this.walkDist = 0;
        this.spawnParticle(this.px, this.py - 2, -this.facing * 24, -18, 0.35, 3, 'rgba(247, 217, 150, 0.5)');
      }
    }

    if (this.onGround) {
      this.coyoteTimer = 0.1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.vy = -BASE_JUMP * power.jumpBonus;
      this.onGround = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      this.scaleX = 0.84;
      this.scaleY = 1.18;
      this.callbacks.onSfx?.('jump');
      for (let i = 0; i < 4; i += 1) {
        this.spawnParticle(this.px + (i - 1.5) * 7, this.py, (i - 1.5) * 32, -26, 0.32, 3, '#a5f3fc');
      }
    }

    this.vy += GRAVITY * dt;
    this.py += this.vy * dt;

    let landed = false;
    if (this.vy >= 0) {
      for (const plat of layout.platforms) {
        if (this.px >= plat.x - 10 && this.px <= plat.x + plat.w + 10) {
          if (prevY <= plat.y + 8 && this.py >= plat.y) {
            this.py = plat.y;
            landed = true;
            break;
          }
        }
      }
      if (!landed) {
        for (const mr of movingRects) {
          if (this.px >= mr.x - 10 && this.px <= mr.x + mr.w + 10) {
            if (prevY <= mr.y + 10 && this.py >= mr.y) {
              this.py = mr.y;
              landed = true;
              break;
            }
          }
        }
      }
      if (!landed) {
        const unlockedSet = new Set(prog.unlockedGates || []);
        for (const gate of layout.gates || []) {
          if (gate.bridgeOnUnlock && unlockedSet.has(gate.id)) {
            if (this.px >= gate.x - 10 && this.px <= gate.x + gate.w + 10) {
              if (prevY <= gate.y + 8 && this.py >= gate.y) {
                this.py = gate.y;
                landed = true;
                break;
              }
            }
          }
        }
      }
      if (!landed) {
        for (const obs of layout.obstacles) {
          if (this.px >= obs.x - 10 && this.px <= obs.x + obs.w + 10) {
            if (prevY <= obs.y + 8 && this.py >= obs.y) {
              this.py = obs.y;
              landed = true;
              break;
            }
          }
        }
      }
    }

    if (!landed && this.py >= layout.groundY) {
      this.py = layout.groundY;
      landed = true;
    }

    if (landed) {
      if (!this.onGround && this.vy > 180) {
        this.scaleX = 1.2;
        this.scaleY = 0.82;
        this.landSquashTimer = 0.18;
      }
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    this.scaleX += (1 - this.scaleX) * Math.min(1, dt * 14);
    this.scaleY += (1 - this.scaleY) * Math.min(1, dt * 14);

    for (const sec of layout.secretZones) {
      const inside =
        this.px >= sec.x - 20 &&
        this.px <= sec.x + sec.width + 20 &&
        this.py >= sec.y - 20 &&
        this.py <= sec.y + sec.height + 20;
      const magicReveal = (heroId === 'sparkle' || heroId === 'sampo') && this.skillActive > 0;
      if ((inside || magicReveal) && !this.revealedSecrets.has(sec.id)) {
        this.revealedSecrets.add(sec.id);
        this.callbacks.onSfx?.('secret');
      }
    }

    // Auto-collect nearby Explore SP crystals
    for (const node of layout.spNodes || []) {
      if ((this.spNodeCooldowns[node.id] || 0) > 0) continue;
      const dist = Math.hypot(node.x - this.px, node.y - 22 - (this.py - 28));
      if (dist < 38) {
        this.spNodeCooldowns[node.id] = 18;
        this.callbacks.onRecoverExploreSp?.(node.id, node.restoreAmount, node.label);
        this.callbacks.onSfx?.('sp_recover');
        for (let k = 0; k < 10; k += 1) {
          const a = (Math.PI * 2 * k) / 10;
          this.spawnParticle(node.x, node.y - 22, Math.cos(a) * 85, Math.sin(a) * 85 - 20, 0.45, 3.6, '#38bdf8');
        }
      }
    }

    // Landmark zone discovery tracking
    const landmarks = layout.landmarks || [];
    for (let idx = 0; idx < landmarks.length; idx += 1) {
      const lm = landmarks[idx];
      const prevBound = idx === 0 ? 0 : (landmarks[idx - 1].x + lm.x) / 2;
      const nextBound = idx === landmarks.length - 1 ? layout.worldWidth : (lm.x + landmarks[idx + 1].x) / 2;
      if (this.px >= prevBound && this.px < nextBound) {
        const zKey = `${this.planetId}:${lm.name}`;
        if (zKey !== this.lastZoneKey) {
          this.lastZoneKey = zKey;
          this.callbacks.onZoneEntered?.(zKey, lm.name);
        }
        break;
      }
    }

    // Update Void Wisp patrol & check collision with player (unless invincible or slashing)
    for (const wisp of this.voidWisps) {
      if (wisp.defeated) continue;
      wisp.x = wisp.baseX + Math.sin(timeSec * wisp.speed + wisp.phase) * wisp.range;
      const dist = Math.hypot(wisp.x - this.px, wisp.y - (this.py - 30));
      if (dist < 28 && this.invulnTimer <= 0 && this.attackTimer <= 0) {
        const knockDir: 1 | -1 = this.px < wisp.x ? -1 : 1;
        this.triggerHurt(knockDir, 10);
      }
    }

    // Update pooled signature world VFX & projectile hits
    for (let i = 0; i < VFX_POOL_SIZE; i += 1) {
      const v = this.vfxPool[i];
      if (!v.active) continue;
      v.x += v.vx * dt;
      v.y += v.vy * dt;
      v.life -= dt;
      if (
        v.kind === 'sparkle_mask' ||
        v.kind === 'sampo_wind' ||
        v.kind === 'nihilux_card_portal' ||
        v.kind === 'sparxie_spark'
      ) {
        for (const wisp of this.voidWisps) {
          if (!wisp.defeated && Math.hypot(wisp.x - v.x, wisp.y - v.y) <= 34) {
            this.defeatWisp(wisp);
          }
        }
      }
      if (v.life <= 0) v.active = false;
    }

    // Smoothly follow companion behind Guardian
    const targetCompX = this.px - this.facing * 38;
    const targetCompY = this.py - 60;
    this.companionX += (targetCompX - this.companionX) * Math.min(1, dt * 6.5);
    this.companionY += (targetCompY - this.companionY) * Math.min(1, dt * 6.5);

    for (let i = 0; i < POOL_SIZE; i += 1) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
    }

    const targetCamX = Math.max(0, Math.min(layout.worldWidth - this.canvas.width, this.px - this.canvas.width * 0.4));
    this.camX += (targetCamX - this.camX) * Math.min(1, dt * 8);

    const items = this.getPlanetInteractables();
    let closest: NearbyInteractable | null = null;
    let closestDist = 78;
    for (const item of items) {
      const d = Math.hypot(item.x - this.px, item.y - this.py);
      if (d < closestDist) {
        closestDist = d;
        closest = item;
      }
    }
    this.nearby = closest;
    const nextId = closest ? closest.id : '';
    if (nextId !== this.lastReportedNearbyId) {
      this.lastReportedNearbyId = nextId;
      this.callbacks.onNearbyChange(closest);
    }
  }

  private render(timeSec: number) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const planet = getPlanetById(this.planetId);
    const layout = getPlanetLayout(this.planetId);
    const heroId = this.callbacks.getHeroId();
    const power = getGuardianPower(heroId);
    const prog = this.callbacks.getProgress();

    // 1. Sky & Nebula Gradients (cached per planet)
    if (this.cachedSkyPlanet !== this.planetId || !this.cachedSkyGrad || !this.cachedNebGrad) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, planet.skyColors[0]);
      grad.addColorStop(0.58, planet.skyColors[1]);
      grad.addColorStop(1, planet.skyColors[2]);
      this.cachedSkyGrad = grad;

      const neb = ctx.createRadialGradient(w * 0.28, 115, 10, w * 0.28, 115, 220);
      neb.addColorStop(0, `${planet.accentColor}33`);
      neb.addColorStop(1, 'transparent');
      this.cachedNebGrad = neb;

      this.cachedSkyPlanet = this.planetId;
    }
    ctx.fillStyle = this.cachedSkyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Celestial Nebula, Stars & Ringed Moon
    this.drawSkyBackdrop(ctx, w, timeSec, planet.accentColor);

    // 3. Far Parallax Ridges / Futuristic Skyline / Floating Archipelago
    this.drawParallaxHorizon(ctx, w, layout.groundY, timeSec);

    // World Space Transform
    ctx.save();
    ctx.translate(-Math.round(this.camX), 0);

    // 4. Midground Props & Detailed Environmental Landmarks
    this.drawLandmarks(ctx, layout, timeSec);
    this.drawEnvironmentalProps(ctx, layout, timeSec);

    // 5. Textured Planet Ground
    this.drawGroundSurface(ctx, layout, planet.groundColor, planet.accentColor, h);

    // 6. Styled Platforms, Moving Platforms, Bridges & Obstacles
    this.drawPlatformsAndObstacles(ctx, layout, planet.platformColor, timeSec, prog);

    // 7. Secret Zones
    for (const sec of layout.secretZones) {
      const revealed = this.revealedSecrets.has(sec.id) || (heroId === 'sparkle' && this.skillActive > 0);
      ctx.save();
      ctx.fillStyle = sec.tint;
      ctx.globalAlpha = revealed ? 0.2 : 0.74;
      ctx.beginPath();
      ctx.roundRect(sec.x, sec.y, sec.width, sec.height, 14);
      ctx.fill();
      ctx.strokeStyle = revealed ? '#f7d996' : 'rgba(192,132,252,0.6)';
      ctx.setLineDash([7, 5]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#f7d996';
      ctx.globalAlpha = revealed ? 0.92 : 0.85;
      ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(revealed ? 'Jalan Rahasia Terbuka' : 'Area Rahasia (?)', sec.x + 14, sec.y + 22);
      ctx.restore();
    }

    // 7.5. Exploration SP Crystals (auto-pickup)
    this.drawSpNodes(ctx, layout, timeSec);

    // 8. Interactables (Spots, Chests, Puzzles, Switches, Gates, Clues, Mechanisms, Activities, NPCs, Boss, Portal)
    this.drawInteractables(ctx, timeSec, prog, heroId);

    // 9. Animated Guardian Player Sprite
    this.drawPlayer(ctx, timeSec, heroId, prog);

    // 9.5. Signature Hero World VFX Pool
    for (let i = 0; i < VFX_POOL_SIZE; i += 1) {
      const v = this.vfxPool[i];
      if (!v.active) continue;
      drawSignatureWorldVfx(ctx, v, timeSec);
    }

    // 10. Particles
    for (let i = 0; i < POOL_SIZE; i += 1) {
      const p = this.particles[i];
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // 11. Active Guardian Skill Radar Banner (Canvas HUD indicator)
    if (this.skillActive > 0) {
      this.drawActiveSkillOverlay(ctx, w, heroId, power);
    }
  }

  private drawSkyBackdrop(ctx: CanvasRenderingContext2D, w: number, timeSec: number, accentColor: string) {
    ctx.save();
    if (this.cachedNebGrad) {
      ctx.fillStyle = this.cachedNebGrad;
      ctx.fillRect(0, 0, w, 340);
    }

    for (let i = 0; i < 44; i += 1) {
      const sx = ((i * 197 - this.camX * 0.14) % w + w) % w;
      const sy = 20 + ((i * 83) % 230);
      const twinkle = 0.35 + 0.55 * Math.sin(timeSec * 2.1 + i);
      ctx.fillStyle = i % 3 === 0 ? `rgba(247,217,150,${twinkle})` : `rgba(255,255,255,${twinkle * 0.85})`;
      ctx.beginPath();
      ctx.arc(sx, sy, i % 5 === 0 ? 2.2 : 1.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nova Metropolis light streaks
    if (this.planetId === 'nova_metropolis') {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        const lx = ((timeSec * (80 + i * 25) + i * 260) % (w + 180)) - 90;
        const ly = 75 + i * 38;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 42, ly);
        ctx.stroke();
      }
    }

    // Ringed Moon / Celestial Body
    const moonX = w * 0.8 - this.camX * 0.04;
    const moonY = 92;
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 44, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#f7d996';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(moonX, moonY, 72, 16, -0.24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawParallaxHorizon(ctx: CanvasRenderingContext2D, w: number, groundY: number, timeSec: number) {
    ctx.save();
    if (this.planetId === 'nova_metropolis') {
      // Distant futuristic skyline with glowing windows
      for (let i = 0; i < 14; i += 1) {
        const bx = ((i * 110 - this.camX * 0.28) % (w + 220) + (w + 220)) % (w + 220) - 110;
        const bh = 120 + ((i * 53) % 140);
        const bw = 64 + (i % 3) * 16;
        ctx.fillStyle = 'rgba(13, 24, 58, 0.84)';
        ctx.fillRect(bx, groundY - bh, bw, bh);
        ctx.strokeStyle = i % 2 === 0 ? 'rgba(56, 189, 248, 0.35)' : 'rgba(192, 132, 252, 0.3)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(bx, groundY - bh, bw, bh);
        // Lit window grid
        ctx.fillStyle = i % 2 === 0 ? 'rgba(125, 211, 252, 0.36)' : 'rgba(247, 217, 150, 0.28)';
        for (let wy = groundY - bh + 16; wy < groundY - 24; wy += 18) {
          for (let wx = bx + 10; wx < bx + bw - 12; wx += 14) {
            if ((wx + wy) % 3 !== 0) {
              ctx.fillRect(wx, wy, 7, 9);
            }
          }
        }
      }
    } else if (this.planetId === 'fusion_kingdom') {
      // Distant floating sky archipelago + silhouettes
      ctx.fillStyle = 'rgba(28, 17, 62, 0.72)';
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (let x = 0; x <= w + 100; x += 100) {
        const wx = x + this.camX * 0.26;
        ctx.lineTo(x, 295 + Math.sin(wx * 0.009) * 52);
      }
      ctx.lineTo(w, groundY);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 4; i += 1) {
        const ix = ((i * 290 - this.camX * 0.22) % (w + 180) + (w + 180)) % (w + 180) - 90;
        const iy = 155 + (i % 2) * 42 + Math.sin(timeSec + i) * 5;
        ctx.fillStyle = 'rgba(88, 28, 135, 0.55)';
        ctx.beginPath();
        ctx.moveTo(ix - 38, iy);
        ctx.lineTo(ix + 38, iy);
        ctx.lineTo(ix + 14, iy + 24);
        ctx.lineTo(ix - 16, iy + 20);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(247, 217, 150, 0.35)';
        ctx.fillRect(ix - 34, iy - 4, 68, 4);
      }
    } else {
      // Layered tropical volcanoes/ridges or dark lost peaks
      ctx.fillStyle = this.planetId === 'lost_civilization' ? 'rgba(17, 8, 34, 0.78)' : 'rgba(8, 24, 38, 0.64)';
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (let x = 0; x <= w + 90; x += 90) {
        const wx = x + this.camX * 0.24;
        const peak = 275 + Math.sin(wx * 0.007) * 55 + Math.cos(wx * 0.015) * 24;
        ctx.lineTo(x, peak);
      }
      ctx.lineTo(w, groundY);
      ctx.closePath();
      ctx.fill();

      // Closer misty hills
      ctx.fillStyle = this.planetId === 'lost_civilization' ? 'rgba(34, 14, 58, 0.58)' : 'rgba(13, 45, 48, 0.55)';
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      for (let x = 0; x <= w + 80; x += 80) {
        const wx = x + this.camX * 0.42;
        const peak = 335 + Math.sin(wx * 0.011 + 1.4) * 34;
        ctx.lineTo(x, peak);
      }
      ctx.lineTo(w, groundY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGroundSurface(
    ctx: CanvasRenderingContext2D,
    layout: ReturnType<typeof getPlanetLayout>,
    groundColor: string,
    accentColor: string,
    h: number
  ) {
    ctx.save();
    const gy = layout.groundY;
    ctx.fillStyle = groundColor;
    ctx.fillRect(0, gy, layout.worldWidth, h - gy);

    // Deeper subsoil layer
    ctx.fillStyle = 'rgba(4, 7, 18, 0.36)';
    ctx.fillRect(0, gy + 24, layout.worldWidth, h - gy - 24);

    // Top rim
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.65;
    ctx.fillRect(0, gy, layout.worldWidth, 4);
    ctx.globalAlpha = 1;

    // Planet-specific repeating floor tiles / grass / cobblestone details (culled to camera viewport)
    const floorStartX = Math.max(0, Math.floor((this.camX - 56) / 56) * 56);
    const floorEndX = Math.min(layout.worldWidth, this.camX + this.canvas.width + 56);
    for (let x = floorStartX; x < floorEndX; x += 56) {
      if (this.planetId === 'terra_nusantara') {
        // Grass blades & pebbles
        ctx.fillStyle = 'rgba(52, 211, 153, 0.35)';
        ctx.beginPath();
        ctx.moveTo(x + 12, gy);
        ctx.lineTo(x + 16, gy - 8);
        ctx.lineTo(x + 20, gy);
        ctx.lineTo(x + 24, gy - 6);
        ctx.lineTo(x + 28, gy);
        ctx.fill();
        ctx.fillStyle = 'rgba(247, 217, 150, 0.14)';
        ctx.beginPath();
        ctx.roundRect(x + 8, gy + 10, 26, 8, 4);
        ctx.fill();
      } else if (this.planetId === 'nova_metropolis') {
        // Futuristic neon sidewalk joints
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.32)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, gy + 4);
        ctx.lineTo(x - 16, gy + 28);
        ctx.stroke();
        ctx.fillStyle = 'rgba(125, 211, 252, 0.35)';
        ctx.fillRect(x + 18, gy + 8, 18, 3);
      } else if (this.planetId === 'fusion_kingdom') {
        // Carved golden inlaid terrace slabs
        ctx.strokeStyle = 'rgba(247, 217, 150, 0.28)';
        ctx.strokeRect(x + 4, gy + 7, 44, 12);
      } else {
        // Lost Civilization cracked ruin slabs & moss
        ctx.fillStyle = 'rgba(192, 132, 252, 0.22)';
        ctx.beginPath();
        ctx.arc(x + 22, gy + 12, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.26)';
        ctx.beginPath();
        ctx.moveTo(x + 10, gy + 4);
        ctx.lineTo(x + 20, gy + 18);
        ctx.lineTo(x + 16, gy + 30);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private drawEnvironmentalProps(
    ctx: CanvasRenderingContext2D,
    layout: ReturnType<typeof getPlanetLayout>,
    timeSec: number
  ) {
    const gy = layout.groundY;
    ctx.save();
    const viewMin = this.camX - 110;
    const viewMax = this.camX + this.canvas.width + 110;
    for (let x = 90; x < layout.worldWidth - 100; x += 270) {
      if (x < viewMin || x > viewMax) continue;
      if (this.planetId === 'terra_nusantara') {
        // Bushes & tropical fern clusters + warm lantern post
        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.arc(x, gy - 10, 18, Math.PI, 0);
        ctx.arc(x + 16, gy - 8, 14, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#475569';
        ctx.beginPath();
        ctx.ellipse(x + 48, gy - 5, 14, 7, 0, Math.PI, 0);
        ctx.fill();
        // Bamboo lantern post
        ctx.strokeStyle = '#92400e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 42, gy);
        ctx.lineTo(x - 42, gy - 52);
        ctx.lineTo(x - 32, gy - 52);
        ctx.stroke();
        const glow = 0.6 + 0.3 * Math.sin(timeSec * 3 + x);
        ctx.fillStyle = `rgba(251, 191, 36, ${glow})`;
        ctx.beginPath();
        ctx.arc(x - 32, gy - 45, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (this.planetId === 'nova_metropolis') {
        // Glowing cyber street lamps
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, gy);
        ctx.lineTo(x, gy - 68);
        ctx.lineTo(x + 16, gy - 68);
        ctx.stroke();
        ctx.fillStyle = '#a5f3fc';
        ctx.fillRect(x + 6, gy - 66, 14, 4);
      } else if (this.planetId === 'fusion_kingdom') {
        // Hybrid lantern pillar
        ctx.fillStyle = '#4c1d95';
        ctx.fillRect(x - 5, gy - 48, 10, 48);
        ctx.fillStyle = '#f7d996';
        ctx.beginPath();
        ctx.roundRect(x - 10, gy - 64, 20, 16, 4);
        ctx.fill();
      } else {
        // Broken ruin pillar & glowing violet spore bush
        ctx.fillStyle = '#3b0764';
        ctx.fillRect(x - 8, gy - 34, 16, 34);
        ctx.fillStyle = `rgba(192, 132, 252, ${0.4 + 0.3 * Math.sin(timeSec * 2 + x)})`;
        ctx.beginPath();
        ctx.arc(x + 34, gy - 12, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  private drawLandmarks(
    ctx: CanvasRenderingContext2D,
    layout: ReturnType<typeof getPlanetLayout>,
    timeSec: number
  ) {
    const baseY = layout.groundY;
    const lmMin = this.camX - 180;
    const lmMax = this.camX + this.canvas.width + 180;
    for (const lm of layout.landmarks) {
      if (lm.x < lmMin || lm.x > lmMax) continue;
      ctx.save();
      if (lm.kind === 'village') {
        // Detailed Pendopo / Joglo village house with warm doorway & lanterns
        ctx.fillStyle = '#3e2723';
        ctx.strokeStyle = '#e5b869';
        ctx.lineWidth = 2;
        ctx.fillRect(lm.x - 62, baseY - 58, 124, 58);
        ctx.strokeRect(lm.x - 62, baseY - 58, 124, 58);
        // Carved doorway & warm light
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(lm.x - 14, baseY - 38, 28, 38);
        ctx.fillStyle = '#78350f';
        ctx.fillRect(lm.x - 46, baseY - 40, 20, 16);
        ctx.fillRect(lm.x + 26, baseY - 40, 20, 16);
        // Joglo 2-tier roof
        ctx.fillStyle = '#5c2d16';
        ctx.beginPath();
        ctx.moveTo(lm.x - 82, baseY - 58);
        ctx.lineTo(lm.x - 36, baseY - 94);
        ctx.lineTo(lm.x + 36, baseY - 94);
        ctx.lineTo(lm.x + 82, baseY - 58);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(lm.x - 42, baseY - 94);
        ctx.lineTo(lm.x, baseY - 124);
        ctx.lineTo(lm.x + 42, baseY - 94);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (lm.kind === 'market') {
        // Traditional market stalls with striped canopies & lantern garland
        ctx.fillStyle = '#451a03';
        ctx.fillRect(lm.x - 74, baseY - 52, 148, 52);
        for (let s = 0; s < 6; s += 1) {
          ctx.fillStyle = s % 2 === 0 ? '#b91c1c' : '#f59e0b';
          ctx.fillRect(lm.x - 80 + s * 27, baseY - 78, 27, 26);
        }
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 2;
        ctx.strokeRect(lm.x - 80, baseY - 78, 162, 26);
        // Spice baskets
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.arc(lm.x - 38, baseY - 12, 12, 0, Math.PI, true);
        ctx.arc(lm.x, baseY - 12, 12, 0, Math.PI, true);
        ctx.arc(lm.x + 38, baseY - 12, 12, 0, Math.PI, true);
        ctx.fill();
      } else if (lm.kind === 'forest') {
        // Multi-trunk lush tropical trees with layered canopies & hanging lianas
        for (let t = -1; t <= 1; t += 1) {
          const tx = lm.x + t * 62;
          const treeH = t === 0 ? 116 : 88;
          ctx.fillStyle = '#3f2e21';
          ctx.beginPath();
          ctx.moveTo(tx - 10, baseY);
          ctx.lineTo(tx - 5, baseY - treeH);
          ctx.lineTo(tx + 5, baseY - treeH);
          ctx.lineTo(tx + 10, baseY);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = t === 0 ? 'rgba(16, 185, 129, 0.42)' : 'rgba(5, 150, 105, 0.35)';
          ctx.beginPath();
          ctx.arc(tx, baseY - treeH - 12, 38, 0, Math.PI * 2);
          ctx.arc(tx - 24, baseY - treeH + 4, 24, 0, Math.PI * 2);
          ctx.arc(tx + 24, baseY - treeH + 4, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(tx - 18, baseY - treeH + 10);
          ctx.lineTo(tx - 18, baseY - treeH + 42);
          ctx.stroke();
        }
      } else if (lm.kind === 'temple' || lm.kind === 'temple_dark' || lm.kind === 'altar' || lm.kind === 'void_altar') {
        const isDark = lm.kind === 'temple_dark' || lm.kind === 'void_altar';
        ctx.fillStyle = isDark ? '#2e1065' : '#334155';
        ctx.strokeStyle = isDark ? '#c084fc' : '#f7d996';
        ctx.lineWidth = 1.8;
        for (let tier = 0; tier < 4; tier += 1) {
          const tw = 134 - tier * 26;
          const th = 22;
          ctx.fillRect(lm.x - tw / 2, baseY - (tier + 1) * th, tw, th);
          ctx.strokeRect(lm.x - tw / 2, baseY - (tier + 1) * th, tw, th);
        }
        // Central arched shrine entrance & flame braziers
        ctx.fillStyle = isDark ? '#a855f7' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(lm.x, baseY - 26, 14, Math.PI, 0);
        ctx.lineTo(lm.x + 14, baseY);
        ctx.lineTo(lm.x - 14, baseY);
        ctx.closePath();
        ctx.fill();
        // Spire
        ctx.fillStyle = isDark ? '#581c87' : '#475569';
        ctx.beginPath();
        ctx.moveTo(lm.x - 16, baseY - 88);
        ctx.lineTo(lm.x, baseY - 122);
        ctx.lineTo(lm.x + 16, baseY - 88);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (lm.kind === 'rumah_adat') {
        // Detailed Minangkabau Rumah Gadang with gonjong horns & stairs
        ctx.fillStyle = '#451a03';
        ctx.strokeStyle = '#f7d996';
        ctx.lineWidth = 2;
        ctx.fillRect(lm.x - 64, baseY - 64, 128, 48);
        ctx.strokeRect(lm.x - 64, baseY - 64, 128, 48);
        // Stilts on batu sandi
        ctx.fillStyle = '#78350f';
        for (let sx = -48; sx <= 48; sx += 32) {
          ctx.fillRect(lm.x + sx - 4, baseY - 16, 8, 16);
        }
        // Curved Gonjong roof
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath();
        ctx.moveTo(lm.x - 86, baseY - 64);
        ctx.quadraticCurveTo(lm.x - 42, baseY - 88, lm.x - 28, baseY - 118);
        ctx.quadraticCurveTo(lm.x, baseY - 86, lm.x + 28, baseY - 118);
        ctx.quadraticCurveTo(lm.x + 42, baseY - 88, lm.x + 86, baseY - 64);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (lm.kind === 'museum' || lm.kind === 'gallery' || lm.kind === 'library') {
        // Grand columned cultural hall / archive or mystical Ancient Library
        const isLib = lm.kind === 'library';
        ctx.fillStyle = isLib ? '#1e1b4b' : '#1e293b';
        ctx.strokeStyle = isLib ? '#c084fc' : '#f7d996';
        ctx.lineWidth = 2;
        ctx.fillRect(lm.x - 74, baseY - 108, 148, 108);
        ctx.strokeRect(lm.x - 74, baseY - 108, 148, 108);
        if (isLib) {
          // Glowing ancient scroll shelves inside the archive
          for (let row = 0; row < 3; row += 1) {
            const ry = baseY - 88 + row * 24;
            ctx.fillStyle = '#312e81';
            ctx.fillRect(lm.x - 58, ry, 116, 14);
            for (let b = 0; b < 9; b += 1) {
              ctx.fillStyle = b % 3 === 0 ? '#f7d996' : b % 2 === 0 ? '#c084fc' : '#38bdf8';
              ctx.fillRect(lm.x - 54 + b * 12, ry + 2, 7, 10);
            }
          }
          // Hovering mystic archive rune orb
          ctx.fillStyle = `rgba(192, 132, 252, ${0.45 + 0.3 * Math.sin(timeSec * 3 + lm.x)})`;
          ctx.beginPath();
          ctx.arc(lm.x, baseY - 146, 8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Pillars
          ctx.fillStyle = 'rgba(247, 217, 150, 0.25)';
          for (let px = -52; px <= 52; px += 26) {
            ctx.fillRect(lm.x + px - 5, baseY - 94, 10, 94);
          }
        }
        // Triangular pediment
        ctx.fillStyle = isLib ? '#4c1d95' : '#334155';
        ctx.beginPath();
        ctx.moveTo(lm.x - 84, baseY - 108);
        ctx.lineTo(lm.x, baseY - 136);
        ctx.lineTo(lm.x + 84, baseY - 108);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (lm.kind === 'cave') {
        // Cave arch + stalactites + glowing mineral crystals
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lm.x, baseY, 72, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(lm.x - 42, baseY - 2);
        ctx.lineTo(lm.x - 34, baseY - 28);
        ctx.lineTo(lm.x - 26, baseY - 2);
        ctx.fill();
      } else if (lm.kind === 'cyber' || lm.kind === 'tower' || lm.kind === 'comms' || lm.kind === 'trade' || lm.kind === 'arena') {
        // Nova Metropolis neon towers, comms dishes & floating hologram billboards
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.fillRect(lm.x - 58, baseY - 126, 116, 126);
        ctx.strokeRect(lm.x - 58, baseY - 126, 116, 126);
        // Neon strips & window panels
        ctx.fillStyle = lm.kind === 'arena' ? '#f472b6' : '#38bdf8';
        ctx.fillRect(lm.x - 52, baseY - 114, 104, 5);
        ctx.fillRect(lm.x - 52, baseY - 64, 104, 4);
        // Floating hologram billboard
        const holoY = baseY - 178 + Math.sin(timeSec * 2.4 + lm.x * 0.01) * 4;
        ctx.fillStyle = 'rgba(14, 165, 233, 0.22)';
        ctx.strokeStyle = lm.kind === 'arena' ? '#f472b6' : '#7dd3fc';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.roundRect(lm.x - 46, holoY, 92, 34, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = lm.kind === 'arena' ? '#fbcfe8' : '#bae6fd';
        ctx.fillRect(lm.x - 36, holoY + 9, 48, 4);
        ctx.fillRect(lm.x - 36, holoY + 18, 70, 3);
        ctx.fillStyle = '#f7d996';
        ctx.beginPath();
        ctx.arc(lm.x + 28, holoY + 11, 5, 0, Math.PI * 2);
        ctx.fill();
        // Comms dish / antenna
        ctx.strokeStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(lm.x, baseY - 126);
        ctx.lineTo(lm.x, baseY - 144);
        ctx.stroke();
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(lm.x, baseY - 144, 3.5 + Math.sin(timeSec * 5), 0, Math.PI * 2);
        ctx.fill();
      } else if (lm.kind === 'sky_island' || lm.kind === 'ruins' || lm.kind === 'ruin_city') {
        // Lost Civilization mystical floating plinths & ancient broken arches
        ctx.fillStyle = '#1e1038';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.fillRect(lm.x - 58, baseY - 88, 22, 88);
        ctx.strokeRect(lm.x - 58, baseY - 88, 22, 88);
        ctx.fillRect(lm.x + 36, baseY - 72, 22, 72);
        ctx.strokeRect(lm.x + 36, baseY - 72, 22, 72);
        // Archway stone lintel
        ctx.fillStyle = '#3b0764';
        ctx.fillRect(lm.x - 64, baseY - 102, 88, 16);
        ctx.strokeRect(lm.x - 64, baseY - 102, 88, 16);
        // Floating crystalline rune fragment
        const fY = baseY - 134 + Math.sin(timeSec * 2 + lm.x * 0.02) * 5;
        ctx.fillStyle = 'rgba(192, 132, 252, 0.35)';
        ctx.beginPath();
        ctx.moveTo(lm.x, fY - 18);
        ctx.lineTo(lm.x + 14, fY);
        ctx.lineTo(lm.x, fY + 18);
        ctx.lineTo(lm.x - 14, fY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Fusion Kingdom Traditional-Futuristic Hybrid Pavilion (Pendopo + Hologram Panels)
        ctx.fillStyle = 'rgba(30, 22, 68, 0.9)';
        ctx.strokeStyle = '#f7d996';
        ctx.lineWidth = 2;
        ctx.fillRect(lm.x - 64, baseY - 96, 128, 96);
        ctx.strokeRect(lm.x - 64, baseY - 96, 128, 96);
        // Glowing cyan holographic screen embedded in traditional wooden pavilion
        ctx.fillStyle = 'rgba(56, 189, 248, 0.24)';
        ctx.strokeStyle = '#38bdf8';
        ctx.fillRect(lm.x - 36, baseY - 78, 72, 34);
        ctx.strokeRect(lm.x - 36, baseY - 78, 72, 34);
        ctx.fillStyle = '#f7d996';
        ctx.fillRect(lm.x - 28, baseY - 68, 56, 4);
        ctx.fillStyle = '#a5f3fc';
        ctx.fillRect(lm.x - 28, baseY - 58, 38, 4);
        // Hybrid curving Nusantara-neon eaves
        ctx.strokeStyle = '#f7d996';
        ctx.beginPath();
        ctx.moveTo(lm.x - 84, baseY - 96);
        ctx.quadraticCurveTo(lm.x - 28, baseY - 114, lm.x, baseY - 136);
        ctx.quadraticCurveTo(lm.x + 28, baseY - 114, lm.x + 84, baseY - 96);
        ctx.closePath();
        ctx.fillStyle = '#581c87';
        ctx.fill();
        ctx.stroke();
      }

      // Signpost Label pill cleanly above landmark & platforms
      const labelY = baseY - 246;
      ctx.font = '700 11.5px "Outfit", sans-serif';
      const tw = ctx.measureText(lm.name).width + 18;
      ctx.fillStyle = 'rgba(9, 13, 30, 0.9)';
      ctx.strokeStyle = 'rgba(247, 217, 150, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(lm.x - tw / 2, labelY - 14, tw, 20, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f7d996';
      ctx.textAlign = 'center';
      ctx.fillText(lm.name, lm.x, labelY);
      ctx.restore();
    }
  }

  private drawPlatformsAndObstacles(
    ctx: CanvasRenderingContext2D,
    layout: ReturnType<typeof getPlanetLayout>,
    platformColor: string,
    timeSec: number,
    prog: ExplorationProgress
  ) {
    const pMin = this.camX - 110;
    const pMax = this.camX + this.canvas.width + 110;
    const drawSinglePlat = (x: number, y: number, w: number, h: number, kind: string, label?: string, moving = false) => {
      if (x + w < pMin || x > pMax) return;
      ctx.save();
      if (kind === 'holo') {
        ctx.fillStyle = moving ? 'rgba(56, 189, 248, 0.36)' : 'rgba(56, 189, 248, 0.25)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = 'rgba(125, 211, 252, 0.16)';
        ctx.fillRect(x + 12, y + h, w - 24, 6);
      } else if (kind === 'crystal') {
        ctx.fillStyle = '#3b0764';
        ctx.beginPath();
        ctx.moveTo(x + 10, y + h);
        ctx.lineTo(x + w / 2, y + h + 18);
        ctx.lineTo(x + w - 10, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = moving ? '#6b21a8' : '#581c87';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = kind === 'ruin' ? '#334155' : platformColor;
        ctx.strokeStyle = kind === 'ruin' ? '#94a3b8' : '#f7d996';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 5);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
        ctx.lineWidth = 1.4;
        for (let px = x + 28; px < x + w - 10; px += 28) {
          ctx.beginPath();
          ctx.moveTo(px, y + 2);
          ctx.lineTo(px, y + h - 2);
          ctx.stroke();
        }
      }
      if (moving) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(x + 10, y + h / 2, 3, 0, Math.PI * 2);
        ctx.arc(x + w - 10, y + h / 2, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (label) {
        ctx.fillStyle = 'rgba(244, 246, 251, 0.85)';
        ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(label, x + 8, y + h + 15);
      }
      ctx.restore();
    };

    for (const plat of layout.platforms) {
      drawSinglePlat(plat.x, plat.y, plat.w, plat.h, plat.kind, plat.label, false);
    }

    for (const mp of layout.movingPlatforms || []) {
      const r = this.getMovingPlatformRect(mp, timeSec);
      drawSinglePlat(r.x, r.y, r.w, r.h, mp.kind, mp.label, true);
    }

    // Switch-activated bridges
    const unlockedGates = new Set(prog.unlockedGates || []);
    for (const gate of layout.gates || []) {
      if (!gate.bridgeOnUnlock) continue;
      if (gate.x + gate.w < pMin || gate.x > pMax) continue;
      const open = unlockedGates.has(gate.id);
      ctx.save();
      if (open) {
        ctx.fillStyle = 'rgba(52, 211, 153, 0.28)';
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(gate.x, gate.y, gate.w, gate.h, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#a7f3d0';
        ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(`${gate.label} ✓`, gate.x + 6, gate.y + gate.h + 14);
      } else {
        ctx.strokeStyle = 'rgba(247, 217, 150, 0.45)';
        ctx.setLineDash([6, 6]);
        ctx.lineWidth = 1.8;
        ctx.strokeRect(gate.x, gate.y, gate.w, gate.h);
        ctx.fillStyle = 'rgba(247, 217, 150, 0.72)';
        ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
        ctx.fillText('Jembatan Nonaktif (Tuas)', gate.x + 4, gate.y - 6);
      }
      ctx.restore();
    }

    for (const obs of layout.obstacles) {
      if (obs.x + obs.w < pMin || obs.x > pMax) continue;
      ctx.save();
      if (obs.kind === 'holo_barrier') {
        ctx.fillStyle = `rgba(56, 189, 248, ${0.28 + 0.12 * Math.sin(timeSec * 4)})`;
        ctx.strokeStyle = '#7dd3fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 5);
        ctx.fill();
        ctx.stroke();
      } else if (obs.kind === 'pillar' || obs.kind === 'cactus_ruin') {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#e5b869';
        ctx.lineWidth = 1.8;
        ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        ctx.fillRect(obs.x - 4, obs.y, obs.w + 8, 8);
      } else {
        ctx.fillStyle = '#6b3e26';
        ctx.strokeStyle = '#f7d996';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 5);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(obs.x + 4, obs.y + 4);
        ctx.lineTo(obs.x + obs.w - 4, obs.y + obs.h - 4);
        ctx.moveTo(obs.x + obs.w - 4, obs.y + 4);
        ctx.lineTo(obs.x + 4, obs.y + obs.h - 4);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawSpNodes(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof getPlanetLayout>, timeSec: number) {
    const viewMin = this.camX - 60;
    const viewMax = this.camX + this.canvas.width + 60;
    for (const node of layout.spNodes || []) {
      if (node.x < viewMin || node.x > viewMax) continue;
      const onCd = (this.spNodeCooldowns[node.id] || 0) > 0;
      const bob = Math.sin(timeSec * 3.8 + node.x * 0.02) * 4;
      ctx.save();
      ctx.translate(node.x, node.y - 24 + (onCd ? 0 : bob));
      ctx.globalAlpha = onCd ? 0.3 : 0.95;
      if (!onCd) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = onCd ? '#64748b' : '#38bdf8';
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 13);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f8fafc';
      ctx.font = '800 9px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(onCd ? 'Isi...' : `+${node.restoreAmount} SP`, 0, -17);
      ctx.restore();
    }
  }

  private drawInteractables(
    ctx: CanvasRenderingContext2D,
    timeSec: number,
    prog: ExplorationProgress,
    heroId: HeroId
  ) {
    const items = this.getPlanetInteractables();
    const sparkleReveal = heroId === 'sparkle' && this.skillActive > 0;
    const sampoChestScan = heroId === 'sampo' && this.skillActive > 0;
    const nihiluxAura = heroId === 'nihilux' && this.skillActive > 0;
    const canFightBoss = canChallengePlanetBoss(prog, this.planetId).allowed;

    const viewMin = this.camX - 180;
    const viewMax = this.camX + this.canvas.width + 180;

    // Render patrolling Void Wisp hazards
    for (const wisp of this.voidWisps) {
      if (!wisp.defeated && wisp.x >= viewMin && wisp.x <= viewMax) {
        drawVoidWisp(ctx, wisp.x, wisp.y, timeSec);
      }
    }

    const RARITY_COLOR: Record<RelicRarity, string> = {
      common: '#34d399',
      rare: '#38bdf8',
      epic: '#c084fc',
      legendary: '#f7d996',
    };

    const HERO_ACCENT: Record<HeroId, string> = {
      sparxie: '#f7d996',
      sparkle: '#fda4af',
      sampo: '#6ee7b7',
      nihilux: '#ddd6fe',
    };

    for (const item of items) {
      const isNear = this.nearby?.id === item.id;
      if (!isNear && (item.x < viewMin || item.x > viewMax)) continue;
      const bob = Math.sin(timeSec * 3 + item.x * 0.02) * 3.5;

      ctx.save();
      if (item.kind === 'spot') {
        if (!item.completed) {
          const rarityColor = item.rarity ? RARITY_COLOR[item.rarity] : '#f7d996';
          const hiddenBehind = item.behindBuilding && !isNear && !sparkleReveal;
          const glowR = sparkleReveal ? 28 : 20;

          if (item.guarded) {
            // Void Sentinel Seal Ring
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 2.2;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.arc(item.x, item.y - 20, 26, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(15, 10, 35, 0.88)';
            ctx.fillRect(item.x - 42, item.y - 58, 84, 16);
            ctx.fillStyle = '#e9d5ff';
            ctx.font = '700 9.5px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Dijaga Void [X]', item.x, item.y - 47);
          } else if (item.missingRelics && item.missingRelics > 0) {
            // Relic-Gated Area Seal
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(item.x, item.y - 20, 25, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(15, 10, 35, 0.9)';
            ctx.fillRect(item.x - 46, item.y - 58, 92, 16);
            ctx.fillStyle = '#fde68a';
            ctx.font = '700 9.5px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`Butuh ${item.requiresPlanetRelics} Artefak`, item.x, item.y - 47);
          } else if (item.guardianChallengeHeroId) {
            // Special Guardian Challenge Star Beacon
            const gCol = HERO_ACCENT[item.guardianChallengeHeroId];
            ctx.fillStyle = `${gCol}38`;
            ctx.beginPath();
            ctx.arc(item.x, item.y - 22 + bob, glowR + 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = gCol;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            for (let p = 0; p < 8; p += 1) {
              const r = p % 2 === 0 ? 15 : 6;
              const a = (Math.PI * p) / 4 + timeSec * 0.8;
              const sx = item.x + Math.cos(a) * r;
              const sy = item.y - 22 + bob + Math.sin(a) * r;
              if (p === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#0b1024';
            ctx.font = '800 10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('★', item.x, item.y - 18.5 + bob);
          } else {
            ctx.globalAlpha = hiddenBehind ? 0.45 : 1;
            ctx.fillStyle = `${rarityColor}40`;
            ctx.beginPath();
            ctx.arc(item.x, item.y - 20 + bob, glowR, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = rarityColor;
            ctx.strokeStyle = '#fffbeb';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(item.x, item.y - 34 + bob);
            ctx.lineTo(item.x + 11, item.y - 20 + bob);
            ctx.lineTo(item.x, item.y - 6 + bob);
            ctx.lineTo(item.x - 11, item.y - 20 + bob);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        } else {
          ctx.fillStyle = 'rgba(52, 211, 153, 0.55)';
          ctx.beginPath();
          ctx.arc(item.x, item.y - 14, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ecfdf5';
          ctx.font = '800 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('✓', item.x, item.y - 11);
        }
      } else if (item.kind === 'chest') {
        const opened = item.completed;
        ctx.fillStyle = opened ? '#334155' : '#78350f';
        ctx.strokeStyle = opened ? '#34d399' : sampoChestScan ? '#6ee7b7' : '#f7d996';
        ctx.lineWidth = sampoChestScan && !opened ? 3 : 2;
        ctx.beginPath();
        ctx.roundRect(item.x - 20, item.y - 24, 40, 24, 4);
        ctx.fill();
        ctx.stroke();
        if (opened) {
          ctx.fillStyle = '#1e293b';
          ctx.beginPath();
          ctx.roundRect(item.x - 21, item.y - 38, 42, 12, 4);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = '#92400e';
          ctx.beginPath();
          ctx.roundRect(item.x - 21, item.y - 31, 42, 10, 4);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#fde68a';
          ctx.fillRect(item.x - 4, item.y - 23, 8, 9);
        }
      } else if (item.kind === 'puzzle') {
        ctx.fillStyle = item.completed ? '#064e3b' : '#312e81';
        ctx.strokeStyle = item.completed ? '#34d399' : '#c084fc';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(item.x - 19, item.y - 48, 38, 48, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = item.completed ? '#34d399' : '#f7d996';
        ctx.font = '800 22px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.completed ? '✓' : '?', item.x, item.y - 16 + (item.completed ? 0 : bob * 0.4));
      } else if (item.kind === 'switch') {
        const active = item.completed;
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = active ? '#34d399' : '#f7d996';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(item.x - 14, item.y - 10, 28, 10, 3);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = active ? '#34d399' : '#fbbf24';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - 10);
        ctx.lineTo(item.x + (active ? 14 : -14), item.y - 34);
        ctx.stroke();
        ctx.fillStyle = active ? '#34d399' : '#fbbf24';
        ctx.beginPath();
        ctx.arc(item.x + (active ? 14 : -14), item.y - 34, 5, 0, Math.PI * 2);
        ctx.fill();
      } else if (item.kind === 'gate') {
        const open = item.completed;
        ctx.fillStyle = open ? 'rgba(52, 211, 153, 0.2)' : 'rgba(245, 158, 11, 0.22)';
        ctx.strokeStyle = open ? '#34d399' : '#fbbf24';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.roundRect(item.x - 20, item.y - 84, 40, 84, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = open ? '#34d399' : '#fde68a';
        ctx.font = '800 13px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(open ? '✓' : '123', item.x, item.y - 42);
      } else if (item.kind === 'clue') {
        const read = item.completed;
        ctx.fillStyle = read ? '#0f172a' : '#1e293b';
        ctx.strokeStyle = read ? '#34d399' : '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(item.x - 14, item.y - 44, 28, 44, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = read ? '#34d399' : '#7dd3fc';
        ctx.fillRect(item.x - 8, item.y - 36, 16, 4);
        ctx.fillRect(item.x - 8, item.y - 28, 12, 3);
        ctx.fillRect(item.x - 8, item.y - 21, 16, 3);
      } else if (item.kind === 'mechanism') {
        const done = item.completed;
        const gCol = item.heroId ? HERO_ACCENT[item.heroId] : '#c084fc';
        ctx.fillStyle = done ? 'rgba(52, 211, 153, 0.24)' : `${gCol}28`;
        ctx.strokeStyle = done ? '#34d399' : gCol;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - 52 + bob * 0.5);
        ctx.lineTo(item.x + 16, item.y - 28 + bob * 0.5);
        ctx.lineTo(item.x, item.y - 4 + bob * 0.5);
        ctx.lineTo(item.x - 16, item.y - 28 + bob * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(done ? '✓' : (item.heroId || 'SP').slice(0, 3).toUpperCase(), item.x, item.y - 24 + bob * 0.5);
      } else if (item.kind === 'activity') {
        const done = item.completed;
        ctx.fillStyle = done ? '#064e3b' : '#172554';
        ctx.strokeStyle = done ? '#34d399' : '#f7d996';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.roundRect(item.x - 18, item.y - 48, 36, 48, 7);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = done ? '#34d399' : '#f7d996';
        ctx.font = '800 16px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(done ? '✓' : '⚙', item.x, item.y - 19 + (done ? 0 : bob * 0.3));
      } else if (item.kind === 'npc') {
        const npcObj = NPC_ENCOUNTERS.find((n) => n.id === item.id);
        if (npcObj) {
          drawAnimeNpc(ctx, npcObj, item.completed, isNear, timeSec);
        }
      } else if (item.kind === 'boss') {
        const boss = BOSS_ENCOUNTERS[this.planetId];
        drawAnimeBoss(ctx, boss, item.completed, canFightBoss, timeSec, nihiluxAura);
      } else if (item.kind === 'portal') {
        const unlocked = item.completed;
        ctx.fillStyle = unlocked ? 'rgba(56, 189, 248, 0.28)' : 'rgba(100, 116, 139, 0.22)';
        ctx.strokeStyle = unlocked ? '#38bdf8' : '#64748b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(item.x, item.y - 48, 22, 42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (unlocked) {
          ctx.strokeStyle = '#f7d996';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.ellipse(item.x, item.y - 48, 13, 28, Math.sin(timeSec * 2) * 0.2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = unlocked ? '#a5f3fc' : '#94a3b8';
        ctx.font = '700 11px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(unlocked ? 'Portal Planet ◎' : 'Portal Terkunci', item.x, item.y - 98);
      }

      if (isNear) {
        const promptOffsetY = item.kind === 'boss' ? -176 : item.kind === 'npc' ? -148 : -112;
        ctx.fillStyle = 'rgba(7, 11, 24, 0.94)';
        ctx.strokeStyle = '#f7d996';
        ctx.lineWidth = 1.8;
        const suffix =
          item.kind === 'portal'
            ? ''
            : item.completed
              ? ' (Selesai)'
              : item.guarded
                ? ' (Kalahkan Void [X]!)'
                : item.missingRelics && item.missingRelics > 0
                  ? ` (Butuh ${item.requiresPlanetRelics} Artefak)`
                  : '';
        const baseLabel = item.kind === 'npc' ? item.label.replace(/\s*\([^)]*\)$/, '') : item.label;
        const promptText = `[E] ${baseLabel}${suffix}`;
        ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
        const tw = Math.min(290, ctx.measureText(promptText).width + 20);
        ctx.beginPath();
        ctx.roundRect(item.x - tw / 2, item.y + promptOffsetY + bob, tw, 26, 8);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f7d996';
        ctx.textAlign = 'center';
        ctx.fillText(promptText, item.x, item.y + promptOffsetY + 17 + bob, 276);
      }
      ctx.restore();
    }
  }

  public computeHeroAnimState(): HeroAnimState {
    if (this.hurtTimer > 0) return 'hurt';
    if (this.attackTimer > 0) return 'attack';
    if (this.celebrateTimer > 0) return 'artifact';
    if (this.interactAnimTimer > 0) return 'interact';
    if (!this.onGround) return 'jump';
    const spd = Math.abs(this.vx);
    if (spd > 292 || (this.held.sprint && spd > 90)) return 'run';
    if (spd > 20) return 'walk';
    return 'idle';
  }

  private getActiveRoleAnim(heroId: HeroId): RoleAnimKind {
    if (this.skillActive <= 0) return null;
    if (heroId === 'sparkle') return 'bonus';
    if (heroId === 'sparxie') return 'clue';
    if (heroId === 'sampo') return 'trick';
    return 'cosmic';
  }

  private getNearestUncollectedAngle(): number | null {
    const targets = this.getPlanetInteractables().filter((t) => !t.completed && t.kind !== 'portal');
    if (targets.length === 0) return null;
    let nearest = targets[0];
    let minD = Math.hypot(nearest.x - this.px, nearest.y - this.py);
    for (const t of targets) {
      const d = Math.hypot(t.x - this.px, t.y - this.py);
      if (d < minD) {
        minD = d;
        nearest = t;
      }
    }
    return Math.atan2(nearest.y - 24 - (this.py - 34), nearest.x - this.px);
  }

  private drawPlayer(
    ctx: CanvasRenderingContext2D,
    timeSec: number,
    heroId: HeroId,
    prog: ExplorationProgress
  ) {
    const animState = this.computeHeroAnimState();
    const roleAnim = this.getActiveRoleAnim(heroId);
    const clueAngle = roleAnim === 'clue' ? this.getNearestUncollectedAngle() : null;

    // Draw Cosmic Companion trailing nearby
    drawCosmicCompanion(ctx, this.companionX, this.companionY, heroId, animState, timeSec, 1);

    // Invulnerability flicker after hurt
    const blinkSkip = this.invulnTimer > 0 && this.hurtTimer <= 0 && Math.floor(timeSec * 16) % 2 === 0;
    ctx.save();
    if (blinkSkip) ctx.globalAlpha = 0.52;
    ctx.translate(this.px, this.py);
    ctx.scale(this.scaleX, this.scaleY);

    if (this.celebrateTimer > 0) {
      ctx.save();
      ctx.strokeStyle = this.celebrateColor;
      ctx.lineWidth = 2.6;
      ctx.globalAlpha = Math.min(0.85, this.celebrateTimer);
      ctx.beginPath();
      ctx.arc(0, -44, 42 + (1.2 - this.celebrateTimer) * 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    drawAnimeHeroSprite(ctx, {
      heroId,
      animState,
      roleAnim,
      facing: this.facing,
      timeSec,
      walkDist: this.walkDist,
      vy: this.vy,
      vx: this.vx,
      animTimer: this.attackTimer,
      skillTimer: this.skillAnimTimer,
      landSquash: this.landSquashTimer / 0.18,
      equippedAccessory: prog.equippedAccessory,
      scale: 1,
      clueAngle,
    });
    ctx.restore();
  }

  private drawActiveSkillOverlay(
    ctx: CanvasRenderingContext2D,
    w: number,
    heroId: HeroId,
    power: ReturnType<typeof getGuardianPower>
  ) {
    const targets = this.getPlanetInteractables().filter((t) => !t.completed && t.kind !== 'portal');
    if (targets.length === 0) return;
    let nearest = targets[0];
    let minD = Math.abs(nearest.x - this.px);
    for (const t of targets) {
      const d = Math.abs(t.x - this.px);
      if (d < minD) {
        minD = d;
        nearest = t;
      }
    }
    const dirText = nearest.x > this.px + 25 ? 'KANAN →' : nearest.x < this.px - 25 ? '← KIRI' : 'DEKAT SINI ★';
    if (heroId === 'sparxie' || heroId === 'nihilux' || heroId === 'sampo' || heroId === 'sparkle') {
      ctx.save();
      ctx.fillStyle = 'rgba(13, 17, 42, 0.9)';
      ctx.strokeStyle = power.accentColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(w / 2 - 170, 14, 340, 32, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = power.accentColor;
      ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${power.skillName}: ${nearest.label} · ${dirText}`, w / 2, 34, 324);
      ctx.restore();
    }
  }
}
