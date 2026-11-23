import { drawAnimeHeroSprite, drawCosmicCompanion, type HeroAnimState, type RoleAnimKind } from './characterArt';
import {
  BOSS_ENCOUNTERS,
  CHEST_ENCOUNTERS,
  EXPLORATION_ACTIVITIES,
  EXPLORATION_MOTTO,
  EXPLORATION_SUPPLIES,
  EXPLORER_ACCESSORIES,
  NPC_ENCOUNTERS,
  PLANETS,
  PUZZLE_ENCOUNTERS,
  RELICS,
  SPOT_ENCOUNTERS,
  WORKSHOP_INGREDIENTS,
  WORKSHOP_RECIPES,
  getGraduatedHintsForEncounter,
  getPlanetById,
  getRelicById,
} from './data';
import { Exploration2DEngine, type NearbyInteractable } from './engine2d';
import {
  activateGuardianMechanism,
  activateWorldSwitch,
  canChallengePlanetBoss,
  claimFullPlanetBonus,
  completePlanetBoss,
  consumeExploreSp,
  evaluateClassificationPuzzle,
  evaluateGateCodePuzzle,
  evaluateSequencePuzzle,
  evaluateSpotAccess,
  evaluateWorkshopCombination,
  evaluateWorkshopQuiz,
  getCodexStats,
  getGraduatedHintStage,
  getGuardianPower,
  getPlanetZoneMapSummary,
  getRelicTier,
  loadExplorationProgress,
  markClueRead,
  markVisitedZone,
  purchaseExplorationSupply,
  purchaseExplorerAccessory,
  recordDilemmaChoice,
  recoverExploreSp,
  saveExplorationProgress,
  shuffleOptionsKeepAnswer,
  unlockRelicInProgress,
  unlockWorldGate,
  useSpPotion,
} from './logic';
import { getRpgCharacterProfile, RPG_CHARACTER_PROFILES } from './portraits';
import { renderLockedRelicSvg, renderRelicSvg } from './relicArt';
import type {
  ExplorationActivity,
  ExplorationProgress,
  HeroId,
  PlanetId,
  RelicCategory,
  RelicItem,
  RelicRarity,
  RelicTier,
  WorkshopRecipe,
} from './types';
import { getPlanetLayout } from './worldMap';

export interface HostGameBridge {
  getHeroId: () => HeroId;
  setHeroId?: (heroId: HeroId) => void;
  getHeroInfo: (heroId: HeroId) => { name: string; role: string; portraitSrc: string; color: string };
  getJades: () => number;
  addJades: (delta: number) => void;
  spendJades: (amount: number) => boolean;
  playSfx?: (kind: string) => void;
  getTheoryCodex?: () => { term: string; origin: string; summary: string }[];
  onCloseToMap?: () => void;
}

const CATEGORY_LABELS: Record<RelicCategory, string> = {
  local: 'LOCAL RELICS',
  global: 'GLOBAL RELICS',
  glocal: 'GLOCAL RELICS',
  lost: 'LOST KNOWLEDGE',
};

const CATEGORY_COLORS: Record<RelicCategory, string> = {
  local: '#34d399',
  global: '#38bdf8',
  glocal: '#f7d996',
  lost: '#c084fc',
};

const RARITY_LABELS: Record<RelicRarity, string> = {
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  legendary: 'LEGENDARY',
};

const RARITY_COLORS: Record<RelicRarity, string> = {
  common: '#34d399',
  rare: '#38bdf8',
  epic: '#c084fc',
  legendary: '#f7d996',
};

const TIER_LABELS: Record<RelicTier, string> = {
  utama: 'ARTEFAK UTAMA',
  tersembunyi: 'ARTEFAK TERSEMBUNYI',
  arsip: 'ARSIP TAMBAHAN',
};

const TIER_COLORS: Record<RelicTier, string> = {
  utama: '#f7d996',
  tersembunyi: '#38bdf8',
  arsip: '#c084fc',
};

export class CosmicExplorationController {
  private bridge: HostGameBridge;
  private progress: ExplorationProgress;
  private rootEl: HTMLElement | null = null;
  private engine: Exploration2DEngine | null = null;
  private isOpen = false;
  private drawerOpen = false;
  private currentPlayerHp = 100;
  private codexFilter: 'all' | RelicCategory | 'history' | 'theory' = 'all';
  private codexPlanetFilter: 'all' | PlanetId = 'all';
  private selectedCodexRelicId: string | null = null;
  private selectedLocalIng = '';
  private selectedGlobalIng = '';
  private activeWorkshopRecipe: WorkshopRecipe | null = null;
  private workshopFeedback = '';
  private manualPaused = false;
  private arrivalNotice = '';
  private guardianPreviewPose: HeroAnimState = 'idle';
  private guardianPreviewRaf: number | null = null;
  private lastSparkleBonusTs = 0;
  private sampoSurprisePlanets = new Set<PlanetId>();
  private toastTimerId: number | null = null;

  constructor(bridge: HostGameBridge) {
    this.bridge = bridge;
    this.progress = loadExplorationProgress();
  }

  public getProgress(): ExplorationProgress {
    return this.progress;
  }

  private persist() {
    this.progress = saveExplorationProgress(this.progress);
  }

  public openExploration(initialPlanet?: PlanetId) {
    this.ensureDomMounted();
    if (!this.rootEl) return;

    if (initialPlanet && this.progress.unlockedPlanets.includes(initialPlanet)) {
      this.progress.activePlanet = initialPlanet;
      this.persist();
    }

    this.isOpen = true;
    this.drawerOpen = false;
    this.manualPaused = false;
    this.arrivalNotice = '';
    this.rootEl.classList.remove('hidden');
    document.body.dataset.exploration = 'open';
    this.setDrawerOpen(false, false);
    this.renderShellHeader();
    this.renderPlanetTabs();
    this.renderMissionSidebar();
    this.renderMissionClue();

    const canvas = document.getElementById('exploration-canvas') as HTMLCanvasElement | null;
    if (canvas && !this.engine) {
      this.engine = new Exploration2DEngine(canvas, {
        getProgress: () => this.progress,
        getHeroId: () => this.bridge.getHeroId(),
        getHeroPortraitUrl: (id) => getRpgCharacterProfile(id).portraitUrl,
        onInteract: (target) => this.handleWorldInteract(target),
        onNearbyChange: (target) => this.updateNearbyPrompt(target),
        onSkillStateChange: (cd, active) => this.updateSkillHud(cd, active),
        onVoidCleared: () => {
          this.bridge.addJades(5);
          this.bridge.playSfx?.('break');
          this.syncHudBars();
          this.showRoleToast(
            this.bridge.getHeroId(),
            'Anomali Void Dibersihkan!',
            '+5 Stellar Jades berhasil diamankan dari gangguan Cultural Void.'
          );
        },
        onPlayerHurt: (dmg) => {
          this.currentPlayerHp = Math.max(20, this.currentPlayerHp - dmg);
          this.bridge.playSfx?.('wrong');
          this.syncHudBars();
        },
        onRoleSkillTriggered: (heroId, info) => this.handleRoleSkillActivated(heroId, info),
        onConsumeExploreSp: (cost) => {
          const res = consumeExploreSp(this.progress, cost);
          if (!res.ok) return false;
          this.progress = res.progress;
          this.persist();
          this.syncHudBars();
          return true;
        },
        onRecoverExploreSp: (_nodeId, amount, label) => {
          const res = recoverExploreSp(this.progress, amount);
          this.progress = res.progress;
          this.persist();
          this.syncHudBars();
          this.showRoleToast(
            this.bridge.getHeroId(),
            'Energi Kosmik Pulih!',
            res.gained > 0
              ? `${label} memulihkan +${res.gained} SP (${res.sp}/${res.maxSp}).`
              : `${label} disentuh — SP sudah penuh (${res.sp}/${res.maxSp}).`
          );
        },
        onZoneEntered: (zoneKey, zoneName) => {
          const res = markVisitedZone(this.progress, zoneKey);
          if (res.newlyVisited) {
            this.progress = res.progress;
            this.persist();
            this.renderMissionSidebar();
            this.showRoleToast(this.bridge.getHeroId(), 'Zona Terjelajahi', `Memasuki wilayah ${zoneName}.`);
          }
        },
        onSkillBlockedLowSp: (needed) => {
          this.showRoleToast(
            this.bridge.getHeroId(),
            'Exploration SP Kurang',
            `Skill butuh ${needed} SP. Sentuh Kristal Biru (+SP) di peta atau klik tombol ⚡ SP!`
          );
        },
        onSfx: (k) => this.bridge.playSfx?.(k === 'jump' || k === 'step' ? 'click' : k),
      });
      this.engine.mount();
    } else if (this.engine) {
      this.engine.setPaused(false);
      this.engine.loadPlanet(this.progress.activePlanet);
    }

    this.syncHudBars();
  }

  public closeExploration() {
    this.isOpen = false;
    this.stopGuardianPreviewLoop();
    this.setDrawerOpen(false, false);
    if (this.engine) {
      this.engine.setPaused(true);
    }
    if (this.rootEl) {
      this.rootEl.classList.add('hidden');
    }
    delete document.body.dataset.exploration;
    this.bridge.onCloseToMap?.();
  }

  public openAstralCodex(defaultTab?: 'all' | RelicCategory | 'history' | 'theory') {
    this.ensureDomMounted();
    if (defaultTab) this.codexFilter = defaultTab;
    this.pauseEngineIfActive(true);
    this.renderCodexModal();
    const modal = document.getElementById('modal-astral-codex');
    modal?.classList.remove('hidden');
  }

  public openWorkshop() {
    this.ensureDomMounted();
    this.pauseEngineIfActive(true);
    this.activeWorkshopRecipe = null;
    this.workshopFeedback = '';
    this.renderWorkshopModal();
    const modal = document.getElementById('modal-workshop');
    modal?.classList.remove('hidden');
  }

  public openAccessoriesModal() {
    this.ensureDomMounted();
    this.pauseEngineIfActive(true);
    this.renderAccessoriesModal();
    const modal = document.getElementById('modal-explore-accessories');
    modal?.classList.remove('hidden');
  }

  public openGuardianSelectModal() {
    this.ensureDomMounted();
    this.pauseEngineIfActive(true);
    this.renderGuardianSelectModal();
    const modal = document.getElementById('modal-guardian-select');
    modal?.classList.remove('hidden');
    this.startGuardianPreviewLoop();
  }

  private closeGuardianSelectModal() {
    this.stopGuardianPreviewLoop();
    document.getElementById('modal-guardian-select')?.classList.add('hidden');
    this.syncHudBars();
    this.renderMissionSidebar();
    this.resumeIfOpen();
  }

  public syncFromHost() {
    if (!this.rootEl || !this.isOpen) return;
    this.syncHudBars();
    this.renderPlanetTabs();
    this.renderMissionSidebar();
    this.renderMissionClue();
    this.engine?.loadPlanet(this.progress.activePlanet);
  }

  private hasOpenModal(): boolean {
    const ids = [
      'modal-exp-encounter',
      'modal-astral-codex',
      'modal-workshop',
      'modal-explore-accessories',
      'modal-guardian-select',
    ];
    return ids.some((id) => {
      const el = document.getElementById(id);
      return el && !el.classList.contains('hidden');
    });
  }

  private pauseEngineIfActive(paused: boolean) {
    if (this.engine && this.isOpen) {
      this.engine.setPaused(paused);
    }
  }

  private resumeIfOpen() {
    if (this.engine && this.isOpen && !this.hasOpenModal() && !this.drawerOpen) {
      this.manualPaused = false;
      const pBtn = document.getElementById('btn-exp-pause');
      if (pBtn) pBtn.textContent = 'Jeda [P]';
      this.engine.setPaused(false);
    }
  }

  private setDrawerOpen(open: boolean, syncEngine = true) {
    this.drawerOpen = open;
    const drawer = document.getElementById('exp-mission-drawer');
    const backdrop = document.getElementById('exp-drawer-backdrop');
    const toggleBtn = document.getElementById('btn-exp-drawer');
    if (open) {
      this.renderMissionSidebar();
      drawer?.classList.add('is-open');
      drawer?.setAttribute('aria-hidden', 'false');
      backdrop?.classList.remove('hidden');
      toggleBtn?.setAttribute('aria-expanded', 'true');
      if (syncEngine) this.pauseEngineIfActive(true);
    } else {
      drawer?.classList.remove('is-open');
      drawer?.setAttribute('aria-hidden', 'true');
      backdrop?.classList.add('hidden');
      toggleBtn?.setAttribute('aria-expanded', 'false');
      if (syncEngine) this.resumeIfOpen();
    }
  }

  private ensureDomMounted() {
    if (this.rootEl && document.getElementById('screen-exploration')) return;

    const style = document.createElement('style');
    style.id = 'cosmic-exploration-styles';
    style.textContent = `
      body[data-exploration="open"] .cosmos-backdrop,
      body[data-exploration="open"] .backdrop-bg,
      body[data-exploration="open"] #screen-title,
      body[data-exploration="open"] #game-shell {
        display: none !important;
      }
      .exp-overlay-root {
        position: fixed;
        inset: 0;
        z-index: 45;
        background: radial-gradient(circle at 22% 10%, rgba(139, 92, 246, 0.24), transparent 46%),
                    radial-gradient(circle at 82% 85%, rgba(56, 189, 248, 0.12), transparent 42%),
                    linear-gradient(180deg, #070b18 0%, #0e1330 56%, #18103a 100%);
        color: #f4f6fb;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 10px 14px 16px;
      }
      .exp-shell {
        max-width: 1080px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      .exp-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 6px 10px;
        padding: 7px 12px;
        background: rgba(13, 17, 42, 0.96);
        border: 1px solid rgba(247, 217, 150, 0.36);
        border-radius: 14px;
        box-shadow: 0 8px 26px rgba(0, 0, 0, 0.35);
      }
      .exp-title-block {
        display: flex;
        flex-direction: column;
        gap: 0;
        min-width: 0;
      }
      .exp-header-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 5px;
      }
      .exp-stat-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4px 9px;
        border-radius: 9px;
        background: rgba(7, 11, 28, 0.92);
        border: 1px solid rgba(247, 217, 150, 0.28);
        font-size: 0.78rem;
      }
      .exp-action-btn {
        min-height: 34px;
        padding: 4px 10px;
        font-size: 0.78rem;
        border-radius: 9px;
      }
      .exp-planets-row {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 7px;
      }
      .exp-planet-tab {
        text-align: left;
        padding: 6px 10px;
        border-radius: 10px;
        background: rgba(13, 18, 44, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #f4f6fb;
        transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
      }
      .exp-planet-tab:hover:not(:disabled) {
        border-color: rgba(247, 217, 150, 0.55);
      }
      .exp-planet-tab.is-active {
        border-color: #f7d996;
        background: linear-gradient(135deg, rgba(38, 31, 82, 0.96), rgba(20, 26, 62, 0.96));
        box-shadow: 0 0 16px rgba(247, 217, 150, 0.2);
      }
      .exp-planet-tab:disabled {
        opacity: 0.48;
        cursor: not-allowed;
      }
      .exp-stage-col {
        display: flex;
        flex-direction: column;
        gap: 7px;
        align-items: center;
      }
      .exp-viewport-wrap {
        position: relative;
        width: 100%;
        max-width: 980px;
        border-radius: 16px;
        overflow: hidden;
        border: 1.5px solid rgba(247, 217, 150, 0.44);
        background: #050916;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
      }
      #exploration-canvas {
        display: block;
        width: 100%;
        height: auto;
        aspect-ratio: 16 / 9;
      }
      .exp-canvas-hud {
        position: absolute;
        inset: 0;
        pointer-events: none;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .exp-hud-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
        flex-wrap: wrap;
      }
      .exp-hud-card {
        pointer-events: auto;
        background: rgba(8, 12, 30, 0.88);
        border: 1px solid rgba(247, 217, 150, 0.38);
        border-radius: 12px;
        padding: 7px 11px;
        display: flex;
        align-items: center;
        gap: 9px;
      }
      .exp-clue-strip {
        width: 100%;
        max-width: 980px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        padding: 7px 12px;
        border-radius: 11px;
        background: rgba(14, 18, 44, 0.94);
        border: 1px solid rgba(167, 139, 250, 0.3);
        font-size: 0.8rem;
        line-height: 1.32;
      }
      .exp-legend-row {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        font-size: 0.74rem;
        color: #cbd5e1;
      }
      .exp-controls-dock {
        width: 100%;
        max-width: 980px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 12px;
        background: rgba(13, 17, 42, 0.95);
        border: 1px solid rgba(247, 217, 150, 0.24);
        border-radius: 14px;
      }
      .exp-touch-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .exp-ctrl-btn {
        min-height: 48px;
        min-width: 60px;
        padding: 8px 14px;
        border-radius: 12px;
        border: 1px solid rgba(247, 217, 150, 0.36);
        background: rgba(24, 30, 68, 0.96);
        color: #f8fafc;
        font-weight: 700;
        font-size: 0.86rem;
        cursor: pointer;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        transition: transform 90ms ease, background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
      }
      .exp-ctrl-btn:active,
      .exp-ctrl-btn.is-pressed {
        transform: scale(0.94);
        background: rgba(52, 42, 108, 0.98);
        border-color: #f7d996;
      }
      .exp-ctrl-interact {
        background: linear-gradient(135deg, #f7d996, #d99f42);
        color: #0b1024;
        border-color: #fef08a;
        box-shadow: 0 0 18px rgba(247, 217, 150, 0.38);
      }
      .exp-ctrl-interact:disabled {
        background: rgba(20, 26, 56, 0.72);
        color: #64748b;
        border-color: rgba(148, 163, 184, 0.22);
        box-shadow: none;
        cursor: not-allowed;
        transform: none;
      }
      .exp-ctrl-jump {
        min-width: 88px;
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.26), rgba(99, 102, 241, 0.34));
        border-color: rgba(125, 211, 252, 0.5);
      }
      .exp-drawer-backdrop {
        position: fixed;
        inset: 0;
        z-index: 60;
        background: rgba(4, 7, 18, 0.68);
      }
      .exp-drawer-backdrop.hidden {
        display: none;
      }
      .exp-drawer {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: min(390px, 92vw);
        z-index: 62;
        background: linear-gradient(180deg, #0d1230 0%, #15143c 100%);
        border-left: 1.5px solid rgba(247, 217, 150, 0.44);
        box-shadow: -16px 0 44px rgba(0, 0, 0, 0.65);
        padding: 16px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 11px;
        transform: translateX(104%);
        transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .exp-drawer.is-open {
        transform: translateX(0);
      }
      .exp-modal-backdrop {
        position: fixed;
        inset: 0;
        z-index: 70;
        background: rgba(4, 7, 18, 0.86);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 14px;
      }
      .exp-modal-backdrop.hidden {
        display: none;
      }
      .exp-modal-card {
        width: 100%;
        max-width: 740px;
        max-height: 90vh;
        overflow-y: auto;
        background: linear-gradient(180deg, #111638 0%, #181442 100%);
        border: 1.5px solid rgba(247, 217, 150, 0.48);
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.65);
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .exp-codex-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 10px;
      }
      .exp-relic-card {
        background: rgba(10, 14, 34, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 10px;
        text-align: left;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 7px;
        color: #f4f6fb;
      }
      .exp-relic-card.is-unlocked {
        border-color: rgba(247, 217, 150, 0.45);
        cursor: pointer;
      }
      .exp-relic-card.is-unlocked:hover {
        border-color: #f7d996;
        transform: translateY(-2px);
      }
      .exp-workshop-cols {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .exp-ing-btn {
        width: 100%;
        padding: 10px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        background: rgba(9, 13, 30, 0.85);
        text-align: left;
        display: flex;
        align-items: center;
        gap: 10px;
        color: #f4f6fb;
      }
      .exp-ing-btn.is-picked {
        border-color: #f7d996;
        background: rgba(46, 36, 92, 0.95);
      }
      .exp-choice-btn {
        width: 100%;
        padding: 12px 14px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(229, 184, 105, 0.32);
        color: #f4f6fb;
        text-align: left;
        font-size: 0.92rem;
      }
      .exp-choice-btn:hover:not(:disabled) {
        background: rgba(229, 184, 105, 0.16);
        border-color: #f7d996;
      }
      @keyframes discoveryShine {
        0% { transform: scale(0.84); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
      .exp-discovery-burst {
        animation: discoveryShine 360ms cubic-bezier(0.16, 1, 0.3, 1);
      }
      @media (max-width: 900px) {
        .exp-planets-row {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .exp-workshop-cols {
          grid-template-columns: 1fr;
        }
        .exp-desktop-keys {
          display: none;
        }
      }
      @media (max-width: 720px) {
        .exp-overlay-root {
          padding: 6px 6px 12px;
        }
        .exp-shell {
          gap: 5px;
        }
        .exp-header {
          padding: 6px 8px;
          gap: 5px;
        }
        .exp-subtitle-desktop {
          display: none;
        }
        .exp-header-actions {
          width: 100%;
          gap: 4px;
        }
        .exp-stat-pill {
          padding: 3px 7px;
          font-size: 0.72rem;
        }
        .exp-action-btn {
          min-height: 32px;
          padding: 3px 7px;
          font-size: 0.72rem;
        }
        .exp-planet-tab {
          padding: 4px 8px;
        }
        .exp-planet-sub {
          display: none;
        }
        .exp-viewport-wrap {
          display: flex;
          flex-direction: column;
        }
        .exp-canvas-hud {
          position: static;
          order: -1;
          padding: 5px 7px;
          background: rgba(8, 12, 30, 0.97);
          border-bottom: 1px solid rgba(247, 217, 150, 0.26);
          gap: 0;
        }
        .exp-hud-top {
          gap: 6px;
          flex-wrap: nowrap;
          align-items: center;
        }
        .exp-hud-card {
          padding: 4px 7px;
          gap: 6px;
          border-radius: 8px;
        }
        .exp-hud-top > .exp-hud-card:first-child {
          flex: 1 1 auto;
          min-width: 0;
        }
        .exp-hud-top > .exp-hud-card:last-child {
          flex: 0 0 auto;
        }
        #exp-hero-avatar {
          width: 28px !important;
          height: 28px !important;
        }
        #exp-planet-badge {
          font-size: 0.64rem !important;
        }
        #exp-planet-count {
          font-size: 0.76rem !important;
        }
        #btn-exp-skill {
          margin-top: 2px !important;
          min-height: 24px !important;
          padding: 2px 6px !important;
          font-size: 0.64rem !important;
          max-width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        #btn-exp-interact-float {
          display: none !important;
        }
        .exp-controls-dock {
          padding: 6px 8px;
          gap: 6px;
        }
        .exp-ctrl-btn {
          min-height: 46px;
          min-width: 44px;
          padding: 5px 8px;
          font-size: 0.74rem;
        }
        .exp-ctrl-jump {
          min-width: 60px;
        }
        .exp-clue-strip {
          padding: 5px 8px;
          font-size: 0.74rem;
        }
        .exp-modal-card {
          padding: 14px;
        }
        .exp-guardian-grid {
          grid-template-columns: 1fr !important;
        }
        .exp-role-toast {
          max-width: calc(100% - 14px) !important;
          padding: 6px 8px !important;
        }
      }
      .exp-ctrl-attack {
        background: linear-gradient(135deg, rgba(192, 132, 252, 0.34), rgba(244, 63, 94, 0.34));
        border-color: rgba(244, 114, 182, 0.65);
      }
      .exp-role-toast {
        position: absolute;
        left: 12px;
        bottom: 12px;
        z-index: 4;
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: 380px;
        padding: 8px 12px;
        border-radius: 12px;
        background: rgba(11, 15, 38, 0.94);
        border: 1.5px solid rgba(247, 217, 150, 0.6);
        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.55);
      }
      .exp-role-toast.hidden {
        display: none;
      }
      .exp-guardian-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .exp-guardian-card {
        background: linear-gradient(180deg, rgba(16, 22, 54, 0.96), rgba(11, 14, 34, 0.98));
        border: 1.5px solid rgba(255, 255, 255, 0.14);
        border-radius: 14px;
        padding: 12px;
        display: flex;
        gap: 12px;
        align-items: stretch;
        transition: border-color 150ms ease, box-shadow 150ms ease;
      }
      .exp-guardian-card.is-selected {
        border-color: #f7d996;
        box-shadow: 0 0 24px rgba(247, 217, 150, 0.22);
      }
      .exp-fullbody-stage {
        position: relative;
        width: 158px;
        flex-shrink: 0;
        border-radius: 12px;
        border: 1px solid rgba(247, 217, 150, 0.28);
        background: radial-gradient(circle at 50% 35%, rgba(139, 92, 246, 0.26), rgba(7, 10, 26, 0.94) 74%);
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }
      .exp-stage-portrait-badge {
        position: absolute;
        top: 6px;
        left: 6px;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        object-fit: cover;
        object-position: center top;
        border: 1.5px solid #f7d996;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
      }
    `;
    if (!document.getElementById('cosmic-exploration-styles')) {
      document.head.appendChild(style);
    }

    const container = document.createElement('div');
    container.id = 'screen-exploration';
    container.className = 'exp-overlay-root hidden';
    container.setAttribute('aria-label', 'Cosmic Exploration: The Lost Relics of Glocalization');

    container.innerHTML = `
      <div class="exp-shell">
        <header class="exp-header">
          <div class="exp-title-block">
            <div style="font-size: 0.68rem; font-weight: 700; letter-spacing: 0.08em; color: #f7d996;">ASTRALVERSE · EKSPLORASI 2D</div>
            <h1 class="font-display" style="margin: 0; font-size: clamp(1rem, 1.9vw, 1.32rem); font-weight: 800; line-height: 1.2;">
              Cosmic Exploration: The Lost Relics of Glocalization
            </h1>
            <p class="exp-subtitle-desktop" style="margin: 0; font-size: 0.76rem; color: #b7c2df;">"${EXPLORATION_MOTTO}"</p>
          </div>
          <div class="exp-header-actions">
            <div class="exp-stat-pill" title="Stellar Jades">
              <span style="color: #8a97b8; font-weight: 700;">Jades</span>
              <strong id="exp-hud-jades" class="tabular-nums" style="color: #f7d996;">0</strong>
            </div>
            <div class="exp-stat-pill" title="Glocal Crystals">
              <span style="color: #8a97b8; font-weight: 700;">Crystals</span>
              <strong id="exp-hud-crystals" class="tabular-nums" style="color: #38bdf8;">0</strong>
            </div>
            <button id="btn-exp-guardians" class="hsr-btn-secondary exp-action-btn" type="button" style="border-color: rgba(247,217,150,0.58); color: #f7d996;">Pilih Penjaga</button>
            <button id="btn-exp-drawer" class="hsr-btn-secondary exp-action-btn" type="button" aria-expanded="false" aria-controls="exp-mission-drawer" style="border-color: rgba(167,139,250,0.55); color: #ddd6fe;">Misi</button>
            <button id="btn-exp-codex" class="hsr-btn-secondary exp-action-btn" type="button">Astral Codex</button>
            <button id="btn-exp-workshop" class="hsr-btn-secondary exp-action-btn" type="button">Workshop</button>
            <button id="btn-exp-accessories" class="hsr-btn-secondary exp-action-btn" type="button">Toko</button>
            <button id="btn-exp-pause" class="hsr-btn-secondary exp-action-btn" type="button">Jeda [P]</button>
            <button id="btn-exp-back" class="hsr-btn-primary exp-action-btn" type="button">Kembali</button>
          </div>
        </header>

        <section id="exp-planet-tabs" class="exp-planets-row" aria-label="Pilih Planet Eksplorasi"></section>

        <div class="exp-stage-col">
          <div class="exp-viewport-wrap">
            <canvas id="exploration-canvas" width="960" height="540" data-testid="exploration-canvas"></canvas>
            <div id="exp-role-toast" class="exp-role-toast hidden" aria-live="polite"></div>
            <div class="exp-canvas-hud">
              <div class="exp-hud-top">
                <div class="exp-hud-card">
                  <img id="exp-hero-avatar" src="" alt="Penjaga Aktif" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; object-position: center top; border: 2px solid #f7d996; cursor: pointer; flex-shrink: 0;" title="Klik untuk ganti Penjaga" />
                  <div style="min-width: 0; flex: 1;">
                    <div style="display: flex; align-items: center; gap: 7px; flex-wrap: wrap;">
                      <span id="exp-hero-name" class="font-display" style="font-weight: 700; font-size: 0.88rem;">Sparxie</span>
                      <span id="exp-hp-text" class="tabular-nums" style="font-size: 0.74rem; color: #34d399; font-weight: 700;">HP 100/100</span>
                      <span id="exp-sp-text" class="tabular-nums" style="font-size: 0.74rem; color: #38bdf8; font-weight: 700;">SP 100/100</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 5px; margin-top: 3px; flex-wrap: wrap;">
                      <button id="btn-exp-skill" class="hsr-btn-skill" type="button" style="min-height: 28px; padding: 3px 9px; font-size: 0.72rem;">
                        [F] Radar Pusaka (Siap)
                      </button>
                      <button id="btn-exp-sp-potion" class="hsr-btn-secondary" type="button" title="Minum Ramuan SP (+50 SP)" style="min-height: 28px; padding: 2px 7px; font-size: 0.7rem; border-color: rgba(56,189,248,0.5); color: #7dd3fc;">
                        ⚡ SP (2)
                      </button>
                      <span id="exp-hint-badge" title="Token Petunjuk Bertahap" class="tabular-nums" style="font-size: 0.7rem; font-weight: 700; color: #fde68a; padding: 2px 6px; border-radius: 6px; background: rgba(247,217,150,0.12); border: 1px solid rgba(247,217,150,0.32);">
                        🔍 2
                      </span>
                    </div>
                  </div>
                </div>
                <div class="exp-hud-card" style="flex-direction: column; align-items: flex-end; gap: 2px;">
                  <span id="exp-planet-badge" style="font-size: 0.72rem; color: #f7d996; font-weight: 700;">Terra Nusantara</span>
                  <span id="exp-planet-count" class="tabular-nums" style="font-size: 0.88rem; font-weight: 800;">Artefak: 0 / 15</span>
                </div>
              </div>
              <div style="display: flex; justify-content: center;">
                <button id="btn-exp-interact-float" class="hsr-btn-primary hidden" type="button" style="pointer-events: auto; min-height: 38px; padding: 6px 15px; font-size: 0.84rem; box-shadow: 0 8px 24px rgba(0,0,0,0.55);">
                  [E] Periksa
                </button>
              </div>
            </div>
          </div>

          <div id="exp-mission-clue" class="exp-clue-strip" aria-live="polite"></div>

          <div class="exp-controls-dock" aria-label="Kontrol Pergerakan Eksplorasi">
            <div class="exp-touch-group">
              <button id="btn-touch-left" class="exp-ctrl-btn" type="button" aria-label="Gerak ke Kiri">←</button>
              <button id="btn-touch-right" class="exp-ctrl-btn" type="button" aria-label="Gerak ke Kanan">→</button>
            </div>
            <div class="exp-desktop-keys" style="font-size: 0.75rem; color: #b7c2df; text-align: center;">
              WASD / Panah Gerak · Spasi Lompat · X Serang · E Interaksi · F Skill · P Jeda
            </div>
            <div class="exp-touch-group">
              <button id="btn-touch-attack" class="exp-ctrl-btn exp-ctrl-attack" type="button" aria-label="Serang Anomali Void">Serang [X]</button>
              <button id="btn-touch-interact" class="exp-ctrl-btn exp-ctrl-interact" type="button" disabled>Interaksi [E]</button>
              <button id="btn-touch-jump" class="exp-ctrl-btn exp-ctrl-jump" type="button" aria-label="Lompat">Lompat ↑</button>
            </div>
          </div>
        </div>
      </div>

      <!-- PANEL GESER MISI & PENJAGA -->
      <div id="exp-drawer-backdrop" class="exp-drawer-backdrop hidden"></div>
      <aside id="exp-mission-drawer" class="exp-drawer" aria-hidden="true" aria-label="Panel Misi dan Penjaga">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid rgba(247,217,150,0.22); padding-bottom: 8px;">
          <div>
            <div style="font-size: 0.7rem; font-weight: 700; color: #f7d996;">NAVIGASI ASTRALVERSE</div>
            <h2 class="font-display" style="margin: 0; font-size: 1.08rem;">Misi, Penanda &amp; Penjaga</h2>
          </div>
          <button id="btn-exp-drawer-close" class="icon-btn" type="button" aria-label="Tutup Panel Misi">✕</button>
        </div>
        <div id="exp-mission-sidebar" style="display: flex; flex-direction: column; gap: 10px;"></div>
      </aside>

      <!-- MODAL PILIH PENJAGA FULL-BODY -->
      <div id="modal-guardian-select" class="exp-modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="guardian-select-title">
        <div id="guardian-select-card" class="exp-modal-card" style="max-width: 920px;"></div>
      </div>

      <!-- MODAL PENEMUAN / TANTANGAN EKSPLORASI -->
      <div id="modal-exp-encounter" class="exp-modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="exp-enc-title">
        <div id="exp-enc-card" class="exp-modal-card"></div>
      </div>

      <!-- MODAL ASTRAL CODEX -->
      <div id="modal-astral-codex" class="exp-modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="astral-codex-title">
        <div id="astral-codex-card" class="exp-modal-card" style="max-width: 920px;"></div>
      </div>

      <!-- MODAL GLOCALIZATION WORKSHOP -->
      <div id="modal-workshop" class="exp-modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="workshop-title">
        <div id="workshop-card" class="exp-modal-card" style="max-width: 860px;"></div>
      </div>

      <!-- MODAL AKSESORI PENJELAJAH -->
      <div id="modal-explore-accessories" class="exp-modal-backdrop hidden" role="dialog" aria-modal="true" aria-labelledby="acc-title">
        <div id="explore-acc-card" class="exp-modal-card" style="max-width: 680px;"></div>
      </div>
    `;

    document.body.appendChild(container);
    this.rootEl = container;
    this.bindStaticEvents();
  }

  private bindStaticEvents() {
    document.getElementById('btn-exp-back')?.addEventListener('click', () => this.closeExploration());
    document.getElementById('btn-exp-guardians')?.addEventListener('click', () => {
      this.bridge.playSfx?.('select');
      this.openGuardianSelectModal();
    });
    document.getElementById('exp-hero-avatar')?.addEventListener('click', () => {
      this.bridge.playSfx?.('select');
      this.openGuardianSelectModal();
    });
    document.getElementById('btn-exp-drawer')?.addEventListener('click', () => {
      this.bridge.playSfx?.('select');
      this.setDrawerOpen(!this.drawerOpen);
    });
    document.getElementById('btn-exp-drawer-close')?.addEventListener('click', () => this.setDrawerOpen(false));
    document.getElementById('exp-drawer-backdrop')?.addEventListener('click', () => this.setDrawerOpen(false));
    document.getElementById('btn-exp-codex')?.addEventListener('click', () => this.openAstralCodex());
    document.getElementById('btn-exp-workshop')?.addEventListener('click', () => this.openWorkshop());
    document.getElementById('btn-exp-accessories')?.addEventListener('click', () => this.openAccessoriesModal());

    const togglePause = () => {
      if (!this.isOpen || this.hasOpenModal() || this.drawerOpen) return;
      this.manualPaused = !this.manualPaused;
      this.engine?.setPaused(this.manualPaused);
      const pBtn = document.getElementById('btn-exp-pause');
      if (pBtn) pBtn.textContent = this.manualPaused ? 'Lanjut [P]' : 'Jeda [P]';
    };
    document.getElementById('btn-exp-pause')?.addEventListener('click', togglePause);
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.key === 'Escape' && this.drawerOpen) {
        this.setDrawerOpen(false);
        return;
      }
      if (e.key.toLowerCase() === 'p' && !e.repeat) {
        togglePause();
      }
    });
    document.getElementById('btn-exp-skill')?.addEventListener('click', () => {
      this.engine?.triggerGuardianSkill();
    });
    document.getElementById('btn-exp-sp-potion')?.addEventListener('click', () => {
      const res = useSpPotion(this.progress);
      if (res.ok) {
        this.progress = res.progress;
        this.persist();
        this.bridge.playSfx?.('sp_recover');
        this.syncHudBars();
        this.showRoleToast(
          this.bridge.getHeroId(),
          'Ramuan SP Digunakan',
          `+${res.gained} Exploration SP dipulihkan (${this.progress.exploreSp}/${this.progress.maxExploreSp}).`
        );
      } else {
        this.bridge.playSfx?.('puzzle_fail');
        this.showRoleToast(this.bridge.getHeroId(), 'Ramuan SP', res.reason || 'Tidak bisa memakai Ramuan SP saat ini.');
      }
    });

    const bindHold = (id: string, dir: 'left' | 'right') => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const onStart = (ev: Event) => {
        ev.preventDefault();
        btn.classList.add('is-pressed');
        this.engine?.setTouchMove(dir, true);
      };
      const onEnd = () => {
        btn.classList.remove('is-pressed');
        this.engine?.setTouchMove(dir, false);
      };
      btn.addEventListener('pointerdown', onStart);
      btn.addEventListener('pointerup', onEnd);
      btn.addEventListener('pointerleave', onEnd);
      btn.addEventListener('pointercancel', onEnd);
    };
    bindHold('btn-touch-left', 'left');
    bindHold('btn-touch-right', 'right');

    const jumpBtn = document.getElementById('btn-touch-jump');
    jumpBtn?.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      jumpBtn.classList.add('is-pressed');
      this.engine?.triggerJump();
    });
    const endJump = () => {
      jumpBtn?.classList.remove('is-pressed');
      this.engine?.releaseJump();
    };
    jumpBtn?.addEventListener('pointerup', endJump);
    jumpBtn?.addEventListener('pointerleave', endJump);
    jumpBtn?.addEventListener('pointercancel', endJump);

    document.getElementById('btn-touch-attack')?.addEventListener('click', () => this.engine?.triggerAttack());
    document.getElementById('btn-touch-interact')?.addEventListener('click', () => this.engine?.triggerInteract());
    document.getElementById('btn-exp-interact-float')?.addEventListener('click', () => this.engine?.triggerInteract());
  }

  private syncHudBars() {
    const heroId = this.bridge.getHeroId();
    const profile = getRpgCharacterProfile(heroId);
    const power = getGuardianPower(heroId);
    const planet = getPlanetById(this.progress.activePlanet);
    const stats = getCodexStats(this.progress);
    const pStat = stats.byPlanet[this.progress.activePlanet];

    const jadesEl = document.getElementById('exp-hud-jades');
    if (jadesEl) jadesEl.textContent = String(Math.round(this.bridge.getJades()));
    const crysEl = document.getElementById('exp-hud-crystals');
    if (crysEl) crysEl.textContent = String(this.progress.glocalCrystals);

    const av = document.getElementById('exp-hero-avatar') as HTMLImageElement | null;
    if (av) {
      av.src = profile.portraitUrl;
      av.style.borderColor = profile.accentColor;
    }
    const hName = document.getElementById('exp-hero-name');
    if (hName) {
      hName.textContent = profile.name;
      hName.style.color = profile.accentColor;
    }
    const hpEl = document.getElementById('exp-hp-text');
    if (hpEl) {
      hpEl.textContent = `HP ${this.currentPlayerHp}/100`;
      hpEl.style.color = this.currentPlayerHp <= 40 ? '#fb7185' : '#34d399';
    }
    const sp = this.progress.exploreSp ?? 100;
    const maxSp = this.progress.maxExploreSp ?? 100;
    const spEl = document.getElementById('exp-sp-text');
    if (spEl) {
      spEl.textContent = `SP ${sp}/${maxSp}`;
      spEl.style.color = sp < 15 ? '#fbbf24' : '#38bdf8';
    }
    const potionBtn = document.getElementById('btn-exp-sp-potion') as HTMLButtonElement | null;
    if (potionBtn) {
      const potCount = this.progress.spPotions ?? 0;
      potionBtn.textContent = `⚡ SP (${potCount})`;
      potionBtn.disabled = potCount <= 0 || sp >= maxSp;
      potionBtn.style.opacity = potionBtn.disabled ? '0.55' : '1';
    }
    const hintBadge = document.getElementById('exp-hint-badge');
    if (hintBadge) {
      hintBadge.textContent = `🔍 ${this.progress.hintTokens ?? 0}`;
    }

    const pBadge = document.getElementById('exp-planet-badge');
    if (pBadge) pBadge.textContent = planet.name;
    const pCount = document.getElementById('exp-planet-count');
    if (pCount) pCount.textContent = `Artefak: ${pStat.found} / ${pStat.total}`;

    const skillBtn = document.getElementById('btn-exp-skill') as HTMLButtonElement | null;
    if (skillBtn && !skillBtn.disabled) {
      skillBtn.textContent = `[F] ${power.skillName} (Siap)`;
    }
  }

  private showRoleToast(heroId: HeroId, heading: string, detail: string) {
    const toast = document.getElementById('exp-role-toast');
    if (!toast) return;
    const profile = getRpgCharacterProfile(heroId);
    toast.innerHTML = `
      <img src="${profile.portraitUrl}" alt="${profile.name}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; object-position: center top; border: 2px solid ${profile.accentColor}; flex-shrink: 0;" />
      <div style="min-width: 0;">
        <div style="font-size: 0.72rem; font-weight: 800; color: ${profile.accentColor};">${profile.name.toUpperCase()} · ${heading}</div>
        <div style="font-size: 0.78rem; color: #f1f5f9; line-height: 1.3;">${detail}</div>
      </div>
    `;
    toast.style.borderColor = profile.accentColor;
    toast.classList.remove('hidden');
    if (this.toastTimerId !== null) {
      window.clearTimeout(this.toastTimerId);
    }
    this.toastTimerId = window.setTimeout(() => {
      toast.classList.add('hidden');
      this.toastTimerId = null;
    }, 3800);
  }

  private handleRoleSkillActivated(heroId: HeroId, info: { revealedSecretCount: number }) {
    const profile = getRpgCharacterProfile(heroId);
    let detail = profile.skillQuote;
    if (heroId === 'sparkle') {
      const now = Date.now();
      if (now - this.lastSparkleBonusTs >= 25000) {
        this.lastSparkleBonusTs = now;
        this.bridge.addJades(5);
        this.syncHudBars();
        detail = `Hujan kartu ilusi! +5 Stellar Jades bonus panggung & ${info.revealedSecretCount > 0 ? 'area rahasia tersingkap!' : 'radar aktif!'}`;
      } else {
        detail = 'Panggung Ilusi bersinar! Menyingkap benda & zona rahasia di sekitarmu.';
      }
    } else if (heroId === 'sampo') {
      if (!this.sampoSurprisePlanets.has(this.progress.activePlanet)) {
        this.sampoSurprisePlanets.add(this.progress.activePlanet);
        this.bridge.addJades(5);
        this.syncHudBars();
        detail = `Tabir rahasia terbuka & kejutan broker +5 Stellar Jades! Peti & kecepatan +25% aktif.`;
      } else {
        detail = `Kecepatan +25% & pemindai peti harta aktif!`;
      }
    } else if (heroId === 'sparxie') {
      detail = 'Radar Pusaka aktif! Ikuti panah emas di layar menuju peninggalan budaya terdekat.';
    } else if (heroId === 'nihilux') {
      detail = 'Energi kosmik ungu-perak menyelimuti medan — segel Boss Penjaga melemah!';
    }
    this.showRoleToast(heroId, getGuardianPower(heroId).skillName, detail);
  }

  private updateSkillHud(cd: number, active: number) {
    const power = getGuardianPower(this.bridge.getHeroId());
    const btn = document.getElementById('btn-exp-skill') as HTMLButtonElement | null;
    if (!btn) return;
    if (active > 0) {
      btn.textContent = `[F] ${power.skillName} · ${Math.ceil(active)}s`;
      btn.disabled = true;
    } else if (cd > 0) {
      btn.textContent = `[F] ${power.skillName} · ${Math.ceil(cd)}s`;
      btn.disabled = true;
    } else {
      btn.textContent = `[F] ${power.skillName} (Siap)`;
      btn.disabled = false;
    }
  }

  private updateNearbyPrompt(target: NearbyInteractable | null) {
    const floatBtn = document.getElementById('btn-exp-interact-float');
    const touchBtn = document.getElementById('btn-touch-interact') as HTMLButtonElement | null;
    if (!target) {
      floatBtn?.classList.add('hidden');
      if (touchBtn) {
        touchBtn.disabled = true;
        touchBtn.textContent = 'Interaksi [E]';
      }
      return;
    }
    if (floatBtn) {
      floatBtn.classList.remove('hidden');
      floatBtn.textContent = `[E] ${target.label}`;
    }
    if (touchBtn) {
      touchBtn.disabled = false;
      const shortLabel = target.label.split('(')[0].trim();
      touchBtn.textContent = shortLabel.length > 20 ? `${shortLabel.slice(0, 19)}…` : `Buka: ${shortLabel}`;
    }
  }

  private renderShellHeader() {
    this.syncHudBars();
  }

  private renderPlanetTabs() {
    const row = document.getElementById('exp-planet-tabs');
    if (!row) return;
    const stats = getCodexStats(this.progress);
    row.innerHTML = '';

    for (const p of PLANETS) {
      const unlocked = this.progress.unlockedPlanets.includes(p.id);
      const completed = this.progress.completedPlanets.includes(p.id);
      const active = this.progress.activePlanet === p.id;
      const pStat = stats.byPlanet[p.id];

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `exp-planet-tab${active ? ' is-active' : ''}`;
      btn.disabled = !unlocked;
      btn.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px;">
          <span style="font-size: 0.7rem; font-weight: 700; color: ${p.accentColor};">PLANET 0${p.order}</span>
          <span class="tabular-nums" style="font-size: 0.72rem; font-weight: 700; color: ${completed ? '#34d399' : '#cbd5e1'};">
            ${unlocked ? `${pStat.found}/${pStat.total}` : 'Terkunci'}
          </span>
        </div>
        <div class="font-display" style="font-weight: 700; font-size: 0.88rem; margin-top: 1px;">${p.name.replace(/^Planet \d+ — /, '')}</div>
        <div class="exp-planet-sub" style="font-size: 0.72rem; color: #94a3b8;">${p.subtitle}</div>
      `;
      btn.addEventListener('click', () => {
        if (!unlocked) return;
        this.arrivalNotice = '';
        this.bridge.playSfx?.('select');
        this.progress.activePlanet = p.id;
        this.persist();
        this.engine?.loadPlanet(p.id);
        this.renderPlanetTabs();
        this.renderMissionSidebar();
        this.renderMissionClue();
        this.syncHudBars();
      });
      row.appendChild(btn);
    }
  }

  private renderMissionClue() {
    const box = document.getElementById('exp-mission-clue');
    if (!box) return;
    const planet = getPlanetById(this.progress.activePlanet);
    const boss = BOSS_ENCOUNTERS[planet.id];
    const bossCheck = canChallengePlanetBoss(this.progress, planet.id);
    const bossDefeated = this.progress.defeatedBosses.includes(boss.id);

    const nextNpc = NPC_ENCOUNTERS.find(
      (n) => n.planetId === planet.id && !this.progress.solvedNpcs.includes(n.id)
    );
    const nextSpot = SPOT_ENCOUNTERS.find(
      (s) => s.planetId === planet.id && !this.progress.inspectedSpots.includes(s.id)
    );
    const nextChest = CHEST_ENCOUNTERS.find(
      (c) => c.planetId === planet.id && !this.progress.openedChests.includes(c.id)
    );
    const nextPuzzle = PUZZLE_ENCOUNTERS.find(
      (pz) => pz.planetId === planet.id && !this.progress.solvedPuzzles.includes(pz.id)
    );

    let missionText = '';
    if (this.arrivalNotice) {
      missionText = `<strong style="color: #38bdf8;">${this.arrivalNotice}</strong>`;
    } else if (!bossDefeated && bossCheck.allowed) {
      missionText = `<strong style="color: #fb7185;">Siap Bertarung!</strong> Menuju sisi timur peta untuk menantang <strong>${boss.name}</strong> (⚔).`;
    } else if (nextNpc) {
      missionText = `<strong style="color: #f7d996;">Petunjuk Misi:</strong> Temui <strong>${nextNpc.name}</strong> (!) atau periksa titik <strong>◆</strong> dan peti harta terdekat.`;
    } else if (nextChest) {
      missionText = `<strong style="color: #f7d996;">Petunjuk Misi:</strong> Buka peti tersembunyi di sekitar <strong>${nextChest.landmark}</strong>.`;
    } else if (nextPuzzle) {
      missionText = `<strong style="color: #c084fc;">Petunjuk Misi:</strong> Pecahkan batu rune <strong>?</strong> di area <strong>${nextPuzzle.landmark}</strong>.`;
    } else if (nextSpot) {
      missionText = `<strong style="color: #f7d996;">Petunjuk Misi:</strong> Periksa penanda <strong>◆ ${nextSpot.label}</strong> di sekitar <strong>${nextSpot.landmark}</strong>.`;
    } else if (!bossDefeated) {
      missionText = `<strong style="color: #fb7185;">Segel Penjaga:</strong> Kumpulkan ${bossCheck.requiredCount - bossCheck.foundCount} artefak lagi untuk melawan <strong>${boss.name}</strong>.`;
    } else {
      missionText = `<strong style="color: #34d399;">Misi Utama Tuntas!</strong> Masuki <strong>Portal ◎</strong> di ujung kanan peta atau padukan relik di <strong>Workshop</strong>.`;
    }

    box.innerHTML = `
      <div>${missionText}</div>
      <div class="exp-legend-row" aria-label="Legenda Peta">
        <span><strong style="color:#f7d996;">◆</strong> Artefak</span>
        <span><strong style="color:#fbbf24;">■</strong> Peti</span>
        <span><strong style="color:#c084fc;">?</strong> Teka-teki</span>
        <span><strong style="color:#34d399;">!</strong> NPC</span>
        <span><strong style="color:#fda4af;">★</strong> Tantangan</span>
        <span><strong style="color:#38bdf8;">⚡</strong> Kristal SP</span>
        <span><strong style="color:#a78bfa;">⚙</strong> Aktivitas</span>
        <span><strong style="color:#fde68a;">📜</strong> Prasasti</span>
        <span><strong style="color:#fb7185;">⚔</strong> Boss</span>
        <span><strong style="color:#38bdf8;">◎</strong> Portal</span>
      </div>
    `;
  }

  private renderMissionSidebar() {
    const box = document.getElementById('exp-mission-sidebar');
    if (!box) return;
    const planet = getPlanetById(this.progress.activePlanet);
    const layout = getPlanetLayout(planet.id);
    const zoneSummary = getPlanetZoneMapSummary(planet.id, this.progress, layout);
    const stats = getCodexStats(this.progress);
    const pStat = stats.byPlanet[planet.id];
    const bossCheck = canChallengePlanetBoss(this.progress, planet.id);
    const boss = BOSS_ENCOUNTERS[planet.id];
    const bossDefeated = this.progress.defeatedBosses.includes(boss.id);
    const heroId = this.bridge.getHeroId();
    const power = getGuardianPower(heroId);

    const npcsLeft = NPC_ENCOUNTERS.filter(
      (n) => n.planetId === planet.id && !this.progress.solvedNpcs.includes(n.id)
    ).length;
    const chestsLeft = CHEST_ENCOUNTERS.filter(
      (c) => c.planetId === planet.id && !this.progress.openedChests.includes(c.id)
    ).length;
    const puzzlesLeft = PUZZLE_ENCOUNTERS.filter(
      (pz) => pz.planetId === planet.id && !this.progress.solvedPuzzles.includes(pz.id)
    ).length;
    const spotsLeft = SPOT_ENCOUNTERS.filter(
      (s) => s.planetId === planet.id && !this.progress.inspectedSpots.includes(s.id)
    ).length;
    const activitiesLeft = (layout.activitySpots || []).filter(
      (a) => !(this.progress.solvedActivities || []).includes(a.activityId)
    ).length;
    const cluesLeft = (layout.clueObjects || []).filter(
      (c) => !(this.progress.readClues || []).includes(c.id)
    ).length;
    const gatesLeft = (layout.gates || []).filter(
      (g) => !(this.progress.unlockedGates || []).includes(g.id)
    ).length;
    const mechsLeft = (layout.mechanisms || []).filter(
      (m) => !(this.progress.activatedMechanisms || []).includes(m.id)
    ).length;

    box.innerHTML = `
      <div>
        <div style="font-size: 0.72rem; font-weight: 700; color: ${planet.accentColor};">MISI PLANET AKTIF</div>
        <h3 class="font-display" style="margin: 2px 0 4px; font-size: 1.04rem;">${planet.name}</h3>
        <p style="margin: 0; font-size: 0.82rem; color: #cbd5e1; line-height: 1.45;">${planet.guardianIntro}</p>
      </div>

      <div class="hsr-panel-inner" style="padding: 10px 12px; display: flex; flex-direction: column; gap: 5px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
          <span>Koleksi Planet</span>
          <strong class="tabular-nums" style="color: #f7d996;">${pStat.found} / ${pStat.total}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
          <span>Syarat Tantang Penjaga</span>
          <strong class="tabular-nums" style="color: ${bossCheck.allowed ? '#34d399' : '#fda4af'};">
            ${Math.min(bossCheck.foundCount, bossCheck.requiredCount)} / ${bossCheck.requiredCount}
          </strong>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem;">
          <span>Status Penjaga (${boss.name})</span>
          <strong style="color: ${bossDefeated ? '#34d399' : '#f7d996'};">${bossDefeated ? 'Tuntas ✓' : bossCheck.allowed ? 'Siap Ditantang!' : 'Belum Terbuka'}</strong>
        </div>
      </div>

      <div class="hsr-panel-inner" style="padding: 10px 12px; font-size: 0.8rem; display: grid; grid-template-columns: 1fr 1fr; gap: 5px 10px;">
        <div style="grid-column: 1 / -1; font-weight: 700; color: #f7d996;">Jejak Tersisa di Planet Ini</div>
        <div>• NPC (!): <strong class="tabular-nums">${npcsLeft}</strong></div>
        <div>• Peti: <strong class="tabular-nums">${chestsLeft}</strong></div>
        <div>• Teka-teki (?): <strong class="tabular-nums">${puzzlesLeft}</strong></div>
        <div>• Titik Budaya (◆): <strong class="tabular-nums">${spotsLeft}</strong></div>
        <div>• Aktivitas (⚙): <strong class="tabular-nums">${activitiesLeft}</strong></div>
        <div>• Prasasti (📜): <strong class="tabular-nums">${cluesLeft}</strong></div>
        <div>• Gerbang/Jembatan: <strong class="tabular-nums">${gatesLeft}</strong></div>
        <div>• Mekanisme: <strong class="tabular-nums">${mechsLeft}</strong></div>
      </div>

      <div class="hsr-panel-inner" style="padding: 10px 12px; font-size: 0.8rem; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-weight: 700; color: #38bdf8;">Peta Jalur Eksplorasi</span>
          <span class="tabular-nums" style="font-size: 0.72rem; color: #94a3b8;">${zoneSummary.filter((z) => z.visited).length}/${zoneSummary.length} Zona</span>
        </div>
        <div style="display: flex; align-items: center; gap: 4px; padding: 4px 0;">
          ${zoneSummary
            .map(
              (z, i) => `
              <div title="${z.name}" style="flex: 1; height: 8px; border-radius: 999px; background: ${
                z.visited ? planet.accentColor : 'rgba(148,163,184,0.22)'
              }; border: 1px solid ${z.visited ? '#f8fafc44' : 'rgba(255,255,255,0.08)'};"></div>
              ${i < zoneSummary.length - 1 ? '<span style="font-size: 0.65rem; color: #64748b;">›</span>' : ''}
            `
            )
            .join('')}
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${zoneSummary
            .map(
              (z) => `
              <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; padding: 4px 7px; border-radius: 7px; background: rgba(8,12,30,0.65); border: 1px solid ${
                z.visited ? `${planet.accentColor}44` : 'rgba(255,255,255,0.06)'
              };">
                <div style="min-width: 0;">
                  <div style="font-weight: 700; font-size: 0.76rem; color: ${z.visited ? '#f8fafc' : '#94a3b8'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${z.visited ? '✓' : '○'} ${z.name}
                  </div>
                  <div style="font-size: 0.68rem; color: #94a3b8;">
                    ${z.activitiesTotal > 0 ? `Aktivitas ${z.activitiesDone}/${z.activitiesTotal}` : 'Wilayah Jelajah'}${
                      z.gatesTotal > 0 ? ` · Gerbang ${z.gatesUnlocked}/${z.gatesTotal}` : ''
                    }
                  </div>
                </div>
                <span class="tabular-nums" style="font-size: 0.68rem; color: ${z.visited ? '#34d399' : '#64748b'}; flex-shrink: 0;">
                  ${Math.round((z.x / layout.worldWidth) * 100)}%
                </span>
              </div>
            `
            )
            .join('')}
        </div>
      </div>

      <div class="hsr-panel-inner" style="padding: 10px 12px; font-size: 0.82rem;">
        <div style="font-weight: 700; color: ${power.accentColor};">Dukungan Penjaga: ${power.skillName}</div>
        <p style="margin: 4px 0 5px; color: #cbd5e1; line-height: 1.4;">${power.shortDesc}</p>
        <div style="color: #94a3b8; font-size: 0.78rem;">Pasif — ${power.passiveName}: ${power.passiveDesc}</div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.78rem; color: #94a3b8; font-weight: 700;">Ganti Karakter Penjaga:</span>
          <button type="button" id="btn-drawer-fullbody" class="hsr-btn-secondary" style="min-height: 28px; padding: 2px 9px; font-size: 0.74rem; border-color: rgba(247,217,150,0.45); color: #f7d996;">Lihat Full-Body</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
          ${(['sparxie', 'sparkle', 'sampo', 'nihilux'] as HeroId[])
            .map(
              (id) => `
            <button type="button" class="hsr-btn-secondary exp-switch-hero" data-hero="${id}" style="min-height: 36px; padding: 5px 10px; font-size: 0.8rem; ${
                id === heroId ? 'border-color: #f7d996; background: rgba(247,217,150,0.2); color: #f7d996;' : ''
              }">
              ${getRpgCharacterProfile(id).name}
            </button>`
            )
            .join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-drawer-fullbody')?.addEventListener('click', () => {
      this.setDrawerOpen(false, false);
      this.openGuardianSelectModal();
    });

    box.querySelectorAll('.exp-switch-hero').forEach((el) => {
      el.addEventListener('click', () => {
        const hid = (el as HTMLElement).dataset.hero as HeroId;
        this.bridge.setHeroId?.(hid);
        this.bridge.playSfx?.('select');
        this.renderMissionSidebar();
        this.syncHudBars();
      });
    });
  }

  private handleWorldInteract(target: NearbyInteractable) {
    this.pauseEngineIfActive(true);
    if (target.kind === 'spot') {
      this.openSpotEncounter(target.id);
    } else if (target.kind === 'chest') {
      this.openChestEncounter(target.id);
    } else if (target.kind === 'npc') {
      this.openNpcEncounter(target.id);
    } else if (target.kind === 'puzzle') {
      this.openPuzzleEncounter(target.id);
    } else if (target.kind === 'switch') {
      this.openSwitchEncounter(target.id);
    } else if (target.kind === 'gate') {
      this.openGateEncounter(target.id);
    } else if (target.kind === 'clue') {
      this.openClueEncounter(target.id);
    } else if (target.kind === 'mechanism') {
      this.openMechanismEncounter(target.id);
    } else if (target.kind === 'activity') {
      this.openActivityEncounter(target.activityId || target.id);
    } else if (target.kind === 'boss') {
      this.openBossEncounter(target.id);
    } else if (target.kind === 'portal') {
      this.openPortalEncounter(target);
    }
  }

  private openPortalEncounter(target: NearbyInteractable) {
    const destId = target.targetPlanetId;
    if (!destId) {
      this.closeEncounterModal();
      return;
    }
    const destPlanet = getPlanetById(destId);
    const unlocked = this.progress.unlockedPlanets.includes(destId);
    if (unlocked) {
      this.arrivalNotice = `Tiba di ${destPlanet.name}! Jelajahi wilayah baru untuk mengumpulkan artefak.`;
      this.progress.activePlanet = destId;
      this.persist();
      this.bridge.playSfx?.('skill');
      this.engine?.loadPlanet(destId);
      this.engine?.triggerCelebration(destPlanet.accentColor);
      this.renderPlanetTabs();
      this.renderMissionSidebar();
      this.renderMissionClue();
      this.syncHudBars();
      this.resumeIfOpen();
      return;
    }

    const currentBoss = BOSS_ENCOUNTERS[this.progress.activePlanet];
    const req = canChallengePlanetBoss(this.progress, this.progress.activePlanet);
    this.openEncounterModal(`
      <div>
        <div style="font-size: 0.76rem; font-weight: 700; color: #38bdf8;">PORTAL ANTARPLANET ASTRALVERSE</div>
        <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.25rem;">${target.label}</h3>
        <p style="margin: 0 0 12px; color: #cbd5e1; line-height: 1.5;">
          Portal menuju <strong style="color: ${destPlanet.accentColor};">${destPlanet.name}</strong> masih tersegel oleh Cultural Void.
          Kumpulkan minimal <strong style="color: #f7d996;">${req.requiredCount} artefak</strong> lalu kalahkan Penjaga Planet
          <strong>${currentBoss.name}</strong> untuk membuka gerbang dimensi ini.
        </p>
        <div class="hsr-panel-inner" style="padding: 10px 12px; font-size: 0.88rem;">
          Artefak terkumpul di planet ini: <strong class="tabular-nums" style="color: #34d399;">${req.foundCount} / ${req.requiredCount}</strong>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
          <button id="btn-enc-cancel" class="hsr-btn-primary" type="button">Kembali Menjelajah</button>
        </div>
      </div>
    `);
    document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
  }

  private openEncounterModal(htmlContent: string) {
    const backdrop = document.getElementById('modal-exp-encounter');
    const card = document.getElementById('exp-enc-card');
    if (!backdrop || !card) return;
    card.innerHTML = htmlContent;
    backdrop.classList.remove('hidden');
  }

  private closeEncounterModal() {
    const backdrop = document.getElementById('modal-exp-encounter');
    backdrop?.classList.add('hidden');
    this.renderPlanetTabs();
    this.renderMissionSidebar();
    this.renderMissionClue();
    this.syncHudBars();
    this.resumeIfOpen();
  }

  private mountGraduatedHintBox(mountId: string, hints: [string, string, string]) {
    const host = document.getElementById(mountId);
    if (!host) return;
    let revealedCount = 0;

    const renderHintUi = (notice?: string) => {
      const tokens = this.progress.hintTokens ?? 0;
      const power = getGuardianPower(this.bridge.getHeroId());
      const nextStageIdx = revealedCount;
      const isNextFree = nextStageIdx === 0 || (nextStageIdx === 1 && power.riddleHintCharges > 0);
      const revealedItems = [];
      for (let i = 0; i < revealedCount; i += 1) {
        const info = getGraduatedHintStage(hints, i);
        revealedItems.push(`
          <div style="padding: 6px 9px; border-radius: 7px; background: rgba(247,217,150,0.08); border: 1px solid rgba(247,217,150,0.28); font-size: 0.82rem; color: #fde68a; line-height: 1.4;">
            <strong>Petunjuk ${info.stage}/3:</strong> ${info.text}
          </div>
        `);
      }

      host.innerHTML = `
        <div class="hsr-panel-inner" style="padding: 9px 11px; display: flex; flex-direction: column; gap: 7px;">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 0.76rem; font-weight: 700; color: #f7d996;">
              Sistem Petunjuk Bertahap · 🔍 Token: <strong class="tabular-nums">${tokens}</strong>
            </span>
            ${
              revealedCount < 3
                ? `<button type="button" class="hsr-btn-secondary exp-next-hint-btn" style="min-height: 30px; padding: 3px 10px; font-size: 0.75rem; border-color: rgba(247,217,150,0.5); color: #f7d996;">
                    Buka Petunjuk ${revealedCount + 1}/3 (${isNextFree ? 'Gratis' : '1 Token'})
                  </button>`
                : `<span style="font-size: 0.74rem; color: #34d399; font-weight: 700;">Semua 3 Petunjuk Terbuka</span>`
            }
          </div>
          ${notice ? `<div style="font-size: 0.78rem; color: #fda4af;">${notice}</div>` : ''}
          ${revealedItems.join('')}
        </div>
      `;

      host.querySelector('.exp-next-hint-btn')?.addEventListener('click', () => {
        if (revealedCount >= 3) return;
        const idx = revealedCount;
        const freeNow = idx === 0 || (idx === 1 && power.riddleHintCharges > 0);
        if (!freeNow) {
          const curTokens = this.progress.hintTokens ?? 0;
          if (curTokens <= 0) {
            this.bridge.playSfx?.('puzzle_fail');
            renderHintUi('Token Petunjuk habis. Beli Lensa Petunjuk Kuno di Toko atau gunakan logika analisis!');
            return;
          }
          this.progress = { ...this.progress, hintTokens: curTokens - 1 };
          this.persist();
          this.syncHudBars();
        }
        revealedCount += 1;
        this.bridge.playSfx?.('select');
        renderHintUi();
      });
    };

    renderHintUi();
  }

  private openSwitchEncounter(switchId: string) {
    const layout = getPlanetLayout(this.progress.activePlanet);
    const sw = (layout.switches || []).find((s) => s.id === switchId);
    if (!sw) return this.closeEncounterModal();

    const res = activateWorldSwitch(this.progress, sw.id, sw.targetGateId);
    this.progress = res.progress;
    this.persist();
    this.bridge.playSfx?.(res.newlyActivated ? 'gate_unlock' : 'select');
    if (res.newlyActivated) {
      this.engine?.triggerCelebration('#38bdf8');
    }

    this.openEncounterModal(`
      <div>
        <div style="font-size: 0.76rem; font-weight: 700; color: #38bdf8;">TUAS &amp; MEKANISME JALUR</div>
        <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.24rem;">${sw.label}</h3>
        <p style="margin: 0 0 12px; color: #e2e8f0; line-height: 1.5;">
          ${
            res.newlyActivated
              ? 'Tuas berhasil diaktifkan! Jembatan energi atau gerbang jalur rahasia telah terbuka untuk dilalui.'
              : 'Tuas ini sudah aktif — jalur penghubung tetap terbuka.'
          }
        </p>
        ${sw.hint ? `<div class="hsr-panel-inner" style="padding: 10px 12px; font-size: 0.86rem; color: #fde68a;">${sw.hint}</div>` : ''}
        <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
          <button id="btn-enc-cancel" class="hsr-btn-primary" type="button">Lanjut Menjelajah</button>
        </div>
      </div>
    `);
    document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
  }

  private openClueEncounter(clueId: string) {
    const layout = getPlanetLayout(this.progress.activePlanet);
    const clue = (layout.clueObjects || []).find((c) => c.id === clueId);
    if (!clue) return this.closeEncounterModal();

    const res = markClueRead(this.progress, clue.id);
    this.progress = res.progress;
    let gainedJades = 0;
    if (res.firstRead && clue.rewardJades > 0) {
      gainedJades = clue.rewardJades;
      this.bridge.addJades(gainedJades);
    }
    this.persist();
    this.bridge.playSfx?.(res.firstRead ? 'reward' : 'select');
    this.syncHudBars();

    const catLabel =
      clue.category === 'clue'
        ? 'PRASASTI PETUNJUK KODE'
        : clue.category === 'archive'
          ? 'ARSIP PENGETAHUAN'
          : 'CATATAN GLOKALISASI';

    this.openEncounterModal(`
      <div>
        <div style="font-size: 0.76rem; font-weight: 700; color: #f7d996;">${catLabel}</div>
        <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.24rem;">${clue.title}</h3>
        <div class="hsr-panel-inner" style="padding: 12px 14px; font-size: 0.9rem; line-height: 1.55; color: #f1f5f9;">
          ${clue.body}
        </div>
        ${
          clue.revealedCode
            ? `<div class="hsr-panel-inner" style="margin-top: 10px; padding: 10px 12px; border-color: #f7d996; background: rgba(247,217,150,0.12); display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                <span style="font-size: 0.84rem; color: #fde68a;">Kode Gerbang Terungkap:</span>
                <strong class="font-display" style="font-size: 1.08rem; color: #f7d996; letter-spacing: 0.08em;">${clue.revealedCode}</strong>
              </div>`
            : ''
        }
        ${
          gainedJades > 0
            ? `<div style="margin-top: 10px; font-size: 0.86rem; font-weight: 700; color: #34d399;">+${gainedJades} Stellar Jades karena mencatat prasasti baru!</div>`
            : ''
        }
        <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
          <button id="btn-enc-cancel" class="hsr-btn-primary" type="button">Catat &amp; Tutup</button>
        </div>
      </div>
    `);
    document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
  }

  private openGateEncounter(gateId: string) {
    const layout = getPlanetLayout(this.progress.activePlanet);
    const gate = (layout.gates || []).find((g) => g.id === gateId);
    if (!gate) return this.closeEncounterModal();

    const isUnlocked = (this.progress.unlockedGates || []).includes(gate.id);
    if (isUnlocked) {
      this.openEncounterModal(`
        <div>
          <div style="font-size: 0.76rem; font-weight: 700; color: #34d399;">GERBANG TERBUKA</div>
          <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.24rem;">${gate.label}</h3>
          <p style="margin: 0 0 12px; color: #cbd5e1;">Segel gerbang ini sudah dibuka. Kamu bebas melintas dan melanjutkan eksplorasi.</p>
          <div style="display: flex; justify-content: flex-end;">
            <button id="btn-enc-cancel" class="hsr-btn-primary" type="button">Lanjutkan</button>
          </div>
        </div>
      `);
      document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
      return;
    }

    if (gate.mode !== 'code') {
      const sw = (layout.switches || []).find((s) => s.id === gate.requiredSwitchId);
      const mech = (layout.mechanisms || []).find((m) => m.targetGateId === gate.id);
      this.bridge.playSfx?.('wrong');
      this.openEncounterModal(`
        <div>
          <div style="font-size: 0.76rem; font-weight: 700; color: #fbbf24;">JALUR TERSEGEL</div>
          <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.24rem;">${gate.label}</h3>
          <p style="margin: 0 0 12px; color: #e2e8f0; line-height: 1.5;">
            ${
              sw
                ? `Aktifkan tuas <strong>${sw.label}</strong> di sekitar wilayah ini untuk membuka ${gate.label}.`
                : mech
                  ? `Aktifkan mekanisme penjaga <strong>${mech.title}</strong> untuk menonaktifkan segel ini.`
                  : 'Cari tuas atau mekanisme penghubung di peta untuk membuka jalur ini.'
            }
          </p>
          <div style="display: flex; justify-content: flex-end;">
            <button id="btn-enc-cancel" class="hsr-btn-primary" type="button">Cari Pemicu</button>
          </div>
        </div>
      `);
      document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
      return;
    }

    const codeClue = (layout.clueObjects || []).find((c) => c.id === gate.codeClueId);
    const clueRead = codeClue ? (this.progress.readClues || []).includes(codeClue.id) : false;
    const codeOpts = gate.codeOptions || (gate.gateCode ? [gate.gateCode] : []);

    this.openEncounterModal(`
      <div>
        <div style="font-size: 0.76rem; font-weight: 700; color: #38bdf8;">GERBANG KODE &amp; PRASASTI</div>
        <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.24rem;">${gate.label}</h3>
        <p style="margin: 0 0 10px; color: #cbd5e1; line-height: 1.48;">
          Masukkan atau pilih kode rahasia yang tercatat pada prasasti di sekitar zona ini untuk membuka peti energi gerbang (+${gate.rewardJades} Jades)!
        </p>
        ${
          codeClue
            ? `<div class="hsr-panel-inner" style="padding: 9px 12px; margin-bottom: 10px; font-size: 0.84rem; color: ${
                clueRead ? '#34d399' : '#fde68a'
              };">
                ${
                  clueRead && codeClue.revealedCode
                    ? `Prasasti <strong>${codeClue.title}</strong> sudah dibaca! Kode tercatat: <strong>${codeClue.revealedCode}</strong>`
                    : `Petunjuk Lokasi Kode: Periksa objek prasasti <strong>"${codeClue.title}"</strong> (📜) di sekitar sini — tidak perlu menebak!`
                }
              </div>`
            : ''
        }
        <div id="exp-gate-options" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; margin-bottom: 10px;">
          ${codeOpts
            .map(
              (code) => `<button type="button" class="exp-choice-btn exp-gate-pick" data-code="${code}" style="text-align: center; font-weight: 700; letter-spacing: 0.04em;">${code}</button>`
            )
            .join('')}
        </div>
        <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 10px;">
          <input id="exp-gate-input" type="text" placeholder="Atau ketik kode di sini..." aria-label="Masukkan kode gerbang"
            style="flex: 1; padding: 8px 10px; border-radius: 8px; background: #090e24; color: #f8fafc; border: 1px solid rgba(56,189,248,0.45); font-size: 0.88rem;" />
          <button id="btn-gate-submit" class="hsr-btn-primary" type="button" style="min-height: 38px;">Buka</button>
        </div>
        <div id="exp-gate-feedback" style="font-size: 0.86rem; margin-bottom: 8px;"></div>
        <div id="exp-gate-hints"></div>
        <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
          <button id="btn-enc-cancel" class="hsr-btn-secondary" type="button">Tutup</button>
        </div>
      </div>
    `);

    const tryCode = (candidate: string) => {
      const check = evaluateGateCodePuzzle(gate, candidate);
      const fb = document.getElementById('exp-gate-feedback');
      if (check.valid) {
        const uRes = unlockWorldGate(this.progress, gate.id);
        this.progress = uRes.progress;
        this.persist();
        if (uRes.newlyUnlocked && gate.rewardJades > 0) {
          this.bridge.addJades(gate.rewardJades);
        }
        this.bridge.playSfx?.('gate_unlock');
        this.engine?.triggerCelebration('#38bdf8');
        this.syncHudBars();
        if (fb) {
          fb.innerHTML = `<span style="color: #34d399; font-weight: 700;">${check.feedback} (+${uRes.newlyUnlocked ? gate.rewardJades : 0} Stellar Jades)</span>`;
        }
        window.setTimeout(() => this.closeEncounterModal(), 900);
      } else {
        this.bridge.playSfx?.('puzzle_fail');
        if (fb) fb.innerHTML = `<span style="color: #fda4af;">${check.feedback}</span>`;
      }
    };

    document.querySelectorAll('.exp-gate-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = (btn as HTMLElement).dataset.code || '';
        const input = document.getElementById('exp-gate-input') as HTMLInputElement | null;
        if (input) input.value = code;
        tryCode(code);
      });
    });
    document.getElementById('btn-gate-submit')?.addEventListener('click', () => {
      const input = document.getElementById('exp-gate-input') as HTMLInputElement | null;
      tryCode(input?.value || '');
    });

    this.mountGraduatedHintBox(
      'exp-gate-hints',
      gate.hints || getGraduatedHintsForEncounter(gate.id, codeClue ? `Baca ${codeClue.title}` : undefined)
    );
    document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
  }

  private openMechanismEncounter(mechId: string) {
    const layout = getPlanetLayout(this.progress.activePlanet);
    const mech = (layout.mechanisms || []).find((m) => m.id === mechId);
    if (!mech) return this.closeEncounterModal();

    const activeHero = this.bridge.getHeroId();
    const targetHeroProf = getRpgCharacterProfile(mech.heroId);
    const alreadyActive = (this.progress.activatedMechanisms || []).includes(mech.id);

    if (alreadyActive) {
      this.openEncounterModal(`
        <div>
          <div style="font-size: 0.76rem; font-weight: 700; color: #34d399;">MEKANISME PENJAGA AKTIF</div>
          <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.24rem;">${mech.title}</h3>
          <p style="margin: 0 0 12px; color: #cbd5e1;">Mekanisme resonansi milik <strong>${targetHeroProf.name}</strong> sudah aktif dan menstabilkan wilayah ini.</p>
          <div style="display: flex; justify-content: flex-end;">
            <button id="btn-enc-cancel" class="hsr-btn-primary" type="button">Kembali Menjelajah</button>
          </div>
        </div>
      `);
      document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
      return;
    }

    const spNow = this.progress.exploreSp ?? 100;
    const isHeroMatch = activeHero === mech.heroId;
    const hasEnoughSp = spNow >= mech.spCost;

    this.openEncounterModal(`
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
          <img src="${targetHeroProf.portraitUrl}" alt="${targetHeroProf.name}" style="width: 46px; height: 46px; border-radius: 50%; object-fit: cover; object-position: center top; border: 2px solid ${targetHeroProf.accentColor}; flex-shrink: 0;" />
          <div>
            <div style="font-size: 0.74rem; font-weight: 800; color: ${targetHeroProf.accentColor};">MEKANISME PENJAGA · ${targetHeroProf.name.toUpperCase()}</div>
            <h3 id="exp-enc-title" class="font-display" style="margin: 2px 0 0; font-size: 1.22rem;">${mech.title}</h3>
          </div>
        </div>
        <p style="margin: 0 0 10px; color: #e2e8f0; line-height: 1.5;">${mech.description}</p>
        <div class="hsr-panel-inner" style="padding: 10px 12px; font-size: 0.84rem; display: flex; flex-direction: column; gap: 5px;">
          <div>Penjaga Resonansi Ideal: <strong style="color: ${targetHeroProf.accentColor};">${targetHeroProf.name}</strong> ${isHeroMatch ? '(Aktif ✓)' : '(Belum Aktif)'}</div>
          <div>Biaya Energi: <strong class="tabular-nums" style="color: ${hasEnoughSp ? '#38bdf8' : '#fda4af'};">${mech.spCost} Exploration SP</strong> (Tersedia: ${spNow})</div>
          <div style="color: #94a3b8; font-size: 0.78rem;">Jalur Alternatif: ${mech.altMethodNote}</div>
        </div>
        <div id="exp-mech-feedback" style="margin-top: 10px; font-size: 0.86rem;"></div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 14px;">
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${
              !isHeroMatch && this.bridge.setHeroId
                ? `<button id="btn-mech-switch" class="hsr-btn-secondary" type="button" style="border-color: ${targetHeroProf.accentColor}; color: ${targetHeroProf.accentColor};">Ganti ke ${targetHeroProf.name}</button>`
                : ''
            }
            <button id="btn-mech-bypass" class="hsr-btn-secondary" type="button" style="font-size: 0.8rem;">Mode Darurat (0 SP)</button>
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btn-enc-cancel" class="hsr-btn-secondary" type="button">Tutup</button>
            <button id="btn-mech-activate" class="hsr-btn-primary" type="button" ${!isHeroMatch || !hasEnoughSp ? 'disabled' : ''}>
              Aktifkan (${mech.spCost} SP)
            </button>
          </div>
        </div>
      </div>
    `);

    const completeMechanism = (jadesEarned: number, modeLabel: string) => {
      const mRes = activateGuardianMechanism(this.progress, mech.id, mech.targetGateId);
      this.progress = mRes.progress;
      this.persist();
      if (mRes.newlyActivated && jadesEarned > 0) {
        this.bridge.addJades(jadesEarned);
      }
      this.bridge.playSfx?.('gate_unlock');
      this.engine?.triggerCelebration(targetHeroProf.accentColor);
      this.syncHudBars();
      const fb = document.getElementById('exp-mech-feedback');
      if (fb) {
        fb.innerHTML = `<span style="color: #34d399; font-weight: 700;">${modeLabel} (+${mRes.newlyActivated ? jadesEarned : 0} Stellar Jades)</span>`;
      }
      window.setTimeout(() => this.closeEncounterModal(), 850);
    };

    document.getElementById('btn-mech-switch')?.addEventListener('click', () => {
      this.bridge.setHeroId?.(mech.heroId);
      this.bridge.playSfx?.('select');
      this.syncHudBars();
      this.renderMissionSidebar();
      this.openMechanismEncounter(mech.id);
    });

    document.getElementById('btn-mech-activate')?.addEventListener('click', () => {
      const spRes = consumeExploreSp(this.progress, mech.spCost);
      if (!spRes.ok) {
        this.bridge.playSfx?.('puzzle_fail');
        const fb = document.getElementById('exp-mech-feedback');
        if (fb) fb.innerHTML = `<span style="color: #fda4af;">SP tidak cukup (${spRes.sp}/${mech.spCost}). Gunakan Ramuan SP atau Mode Darurat!</span>`;
        return;
      }
      this.progress = spRes.progress;
      completeMechanism(mech.rewardJades, `Resonansi ${targetHeroProf.name} berhasil diaktifkan!`);
    });

    document.getElementById('btn-mech-bypass')?.addEventListener('click', () => {
      const fallbackJades = Math.max(5, Math.floor(mech.rewardJades / 2));
      completeMechanism(fallbackJades, 'Mekanisme diaktifkan via kalibrasi manual (Mode Darurat)!');
    });

    document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
  }

  private openActivityEncounter(activityId: string) {
    const act: ExplorationActivity | undefined = EXPLORATION_ACTIVITIES.find((a) => a.id === activityId);
    if (!act) return this.closeEncounterModal();

    const alreadySolved = (this.progress.solvedActivities || []).includes(act.id);

    if (act.kind === 'classification') {
      const groups = act.groups || [];
      const items = act.items || [];
      this.openEncounterModal(`
        <div>
          <div style="font-size: 0.76rem; font-weight: 700; color: #a78bfa;">AKTIVITAS KLASIFIKASI · ${act.subtitle.toUpperCase()}</div>
          <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.24rem;">${act.title}</h3>
          <p style="margin: 0 0 12px; color: #cbd5e1; line-height: 1.48;">${act.prompt}</p>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${items
              .map(
                (item) => `
              <div class="hsr-panel-inner" style="padding: 9px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
                <strong style="font-size: 0.88rem;">${item.text}</strong>
                <select class="exp-class-select" data-item-id="${item.id}" aria-label="Pilih kategori untuk ${item.text}"
                  style="padding: 7px 10px; border-radius: 8px; background: #090e24; color: #f8fafc; border: 1px solid rgba(167,139,250,0.45); font-size: 0.84rem; min-width: 195px;">
                  <option value="">-- Pilih Kelompok --</option>
                  ${groups.map((g) => `<option value="${g}" ${alreadySolved && g === item.group ? 'selected' : ''}>${g}</option>`).join('')}
                </select>
              </div>
            `
              )
              .join('')}
          </div>
          <div id="exp-act-feedback" style="margin-top: 10px; font-size: 0.86rem;">
            ${alreadySolved ? `<span style="color: #34d399;">Aktivitas ini sudah diselesaikan! ${act.explanation}</span>` : ''}
          </div>
          <div id="exp-act-hints" style="margin-top: 10px;"></div>
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
            <button id="btn-enc-cancel" class="hsr-btn-secondary" type="button">Tutup</button>
            <button id="btn-act-check" class="hsr-btn-primary" type="button">Periksa Klasifikasi</button>
          </div>
        </div>
      `);

      this.mountGraduatedHintBox('exp-act-hints', act.hints);
      document.getElementById('btn-act-check')?.addEventListener('click', () => {
        const assignments: Record<string, string> = {};
        document.querySelectorAll('.exp-class-select').forEach((sel) => {
          const el = sel as HTMLSelectElement;
          const id = el.dataset.itemId || '';
          assignments[id] = el.value;
        });
        const evalRes = evaluateClassificationPuzzle(act, assignments);
        const fb = document.getElementById('exp-act-feedback');
        if (evalRes.valid) {
          const firstTime = !(this.progress.solvedActivities || []).includes(act.id);
          if (firstTime) {
            this.progress = {
              ...this.progress,
              solvedActivities: [...(this.progress.solvedActivities || []), act.id],
            };
            this.persist();
            this.bridge.addJades(act.rewardJades);
          }
          this.bridge.playSfx?.('puzzle_success');
          this.engine?.triggerCelebration('#a78bfa');
          this.syncHudBars();
          if (fb) {
            fb.innerHTML = `<span style="color: #34d399; font-weight: 700;">${evalRes.feedback} ${act.explanation} (${
              firstTime ? `+${act.rewardJades} Jades` : 'Selesai'
            })</span>`;
          }
          window.setTimeout(() => this.closeEncounterModal(), 1100);
        } else {
          this.bridge.playSfx?.('puzzle_fail');
          if (fb) fb.innerHTML = `<span style="color: #fda4af;">${evalRes.feedback}</span>`;
        }
      });
      document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
      return;
    }

    if (act.kind === 'sequence') {
      const steps = [...(act.steps || [])];
      if (!alreadySolved && steps.length >= 2) {
        steps.reverse();
      } else {
        steps.sort((a, b) => a.correctOrder - b.correctOrder);
      }

      const renderSeqRows = () => {
        const list = document.getElementById('exp-seq-list');
        if (!list) return;
        list.innerHTML = steps
          .map(
            (st, idx) => `
          <div class="hsr-panel-inner" style="padding: 9px 12px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 9px; font-size: 0.86rem;">
              <span class="tabular-nums" style="width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; background: rgba(167,139,250,0.24); color: #ddd6fe; font-weight: 800; flex-shrink: 0;">${
                idx + 1
              }</span>
              <span>${st.text}</span>
            </div>
            <div style="display: flex; gap: 4px; flex-shrink: 0;">
              <button type="button" class="hsr-btn-secondary exp-seq-up" data-idx="${idx}" aria-label="Geser ke atas" style="min-height: 30px; padding: 2px 8px;" ${
                idx === 0 ? 'disabled' : ''
              }>↑</button>
              <button type="button" class="hsr-btn-secondary exp-seq-down" data-idx="${idx}" aria-label="Geser ke bawah" style="min-height: 30px; padding: 2px 8px;" ${
                idx === steps.length - 1 ? 'disabled' : ''
              }>↓</button>
            </div>
          </div>
        `
          )
          .join('');

        list.querySelectorAll('.exp-seq-up').forEach((btn) => {
          btn.addEventListener('click', () => {
            const i = Number((btn as HTMLElement).dataset.idx);
            if (i > 0) {
              const tmp = steps[i - 1];
              steps[i - 1] = steps[i];
              steps[i] = tmp;
              this.bridge.playSfx?.('click');
              renderSeqRows();
            }
          });
        });
        list.querySelectorAll('.exp-seq-down').forEach((btn) => {
          btn.addEventListener('click', () => {
            const i = Number((btn as HTMLElement).dataset.idx);
            if (i < steps.length - 1) {
              const tmp = steps[i + 1];
              steps[i + 1] = steps[i];
              steps[i] = tmp;
              this.bridge.playSfx?.('click');
              renderSeqRows();
            }
          });
        });
      };

      this.openEncounterModal(`
        <div>
          <div style="font-size: 0.76rem; font-weight: 700; color: #38bdf8;">AKTIVITAS PENGURUTAN · ${act.subtitle.toUpperCase()}</div>
          <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.24rem;">${act.title}</h3>
          <p style="margin: 0 0 12px; color: #cbd5e1; line-height: 1.48;">${act.prompt}</p>
          <div id="exp-seq-list" style="display: flex; flex-direction: column; gap: 8px;"></div>
          <div id="exp-act-feedback" style="margin-top: 10px; font-size: 0.86rem;">
            ${alreadySolved ? `<span style="color: #34d399;">Urutan sudah terselesaikan! ${act.explanation}</span>` : ''}
          </div>
          <div id="exp-act-hints" style="margin-top: 10px;"></div>
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
            <button id="btn-enc-cancel" class="hsr-btn-secondary" type="button">Tutup</button>
            <button id="btn-seq-check" class="hsr-btn-primary" type="button">Periksa Urutan</button>
          </div>
        </div>
      `);

      renderSeqRows();
      this.mountGraduatedHintBox('exp-act-hints', act.hints);

      document.getElementById('btn-seq-check')?.addEventListener('click', () => {
        const evalRes = evaluateSequencePuzzle(
          act,
          steps.map((s) => s.id)
        );
        const fb = document.getElementById('exp-act-feedback');
        if (evalRes.valid) {
          const firstTime = !(this.progress.solvedActivities || []).includes(act.id);
          if (firstTime) {
            this.progress = {
              ...this.progress,
              solvedActivities: [...(this.progress.solvedActivities || []), act.id],
            };
            this.persist();
            this.bridge.addJades(act.rewardJades);
          }
          this.bridge.playSfx?.('puzzle_success');
          this.engine?.triggerCelebration('#38bdf8');
          this.syncHudBars();
          if (fb) {
            fb.innerHTML = `<span style="color: #34d399; font-weight: 700;">${evalRes.feedback} ${act.explanation} (${
              firstTime ? `+${act.rewardJades} Jades` : 'Selesai'
            })</span>`;
          }
          window.setTimeout(() => this.closeEncounterModal(), 1100);
        } else {
          this.bridge.playSfx?.('puzzle_fail');
          if (fb) fb.innerHTML = `<span style="color: #fda4af;">${evalRes.feedback}</span>`;
        }
      });
      document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
      return;
    }

    // kind === 'dilemma'
    const choices = act.choices || [];
    const prevChoiceId = (this.progress.dilemmaChoices || {})[act.id];
    const prevChoice = choices.find((c) => c.id === prevChoiceId);

    this.openEncounterModal(`
      <div>
        <div style="font-size: 0.76rem; font-weight: 700; color: #f7d996;">DILEMA GLOKALISASI · ${act.subtitle.toUpperCase()}</div>
        <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.24rem;">${act.title}</h3>
        <div class="hsr-panel-inner" style="padding: 12px 14px; font-size: 0.92rem; line-height: 1.5; margin-bottom: 12px;">
          ${act.prompt}
        </div>
        <div id="exp-dilemma-choices" style="display: flex; flex-direction: column; gap: 8px;">
          ${choices
            .map(
              (c) => `<button type="button" class="exp-choice-btn exp-dilemma-pick" data-choice-id="${c.id}" style="${
                c.id === prevChoiceId ? 'border-color: #34d399;' : ''
              }">${c.label}</button>`
            )
            .join('')}
        </div>
        <div id="exp-dilemma-outcome" style="margin-top: 10px;">
          ${
            prevChoice
              ? `<div class="hsr-panel-inner" style="padding: 10px 12px; border-color: #34d399; font-size: 0.86rem;">
                  <div style="font-weight: 700; color: #34d399;">${prevChoice.outcomeTitle}</div>
                  <p style="margin: 4px 0;">${prevChoice.outcomeBody}</p>
                  <div style="color: #94a3b8; font-size: 0.8rem;">Catatan Codex: ${prevChoice.codexNote}</div>
                </div>`
              : ''
          }
        </div>
        <div id="exp-act-hints" style="margin-top: 10px;"></div>
        <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
          <button id="btn-enc-cancel" class="hsr-btn-secondary" type="button">Tutup</button>
        </div>
      </div>
    `);

    this.mountGraduatedHintBox('exp-act-hints', act.hints);

    document.querySelectorAll('.exp-dilemma-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = (btn as HTMLElement).dataset.choiceId || '';
        const picked = choices.find((c) => c.id === cid);
        if (!picked) return;
        const dRes = recordDilemmaChoice(this.progress, act.id, picked.id);
        this.progress = dRes.progress;
        this.persist();
        const jades = dRes.firstTime ? picked.rewardJades : 0;
        if (jades > 0) {
          this.bridge.addJades(jades);
        }
        this.bridge.playSfx?.('puzzle_success');
        this.engine?.triggerCelebration('#f7d996');
        this.syncHudBars();
        const out = document.getElementById('exp-dilemma-outcome');
        if (out) {
          out.innerHTML = `
            <div class="hsr-panel-inner" style="padding: 11px 13px; border-color: #f7d996; font-size: 0.88rem;">
              <div style="font-weight: 700; color: #f7d996;">${picked.outcomeTitle} ${jades > 0 ? `(+${jades} Stellar Jades)` : ''}</div>
              <p style="margin: 5px 0;">${picked.outcomeBody}</p>
              <div style="color: #a5f3fc; font-size: 0.82rem;"><strong>Catatan Codex:</strong> ${picked.codexNote}</div>
            </div>
          `;
        }
      });
    });
    document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
  }

  private awardRelicAndShowPanel(
    relicId: string,
    methodLabel: string,
    baseJades: number,
    extraNote?: string
  ) {
    const relic = getRelicById(relicId);
    if (!relic) {
      this.closeEncounterModal();
      return;
    }
    const res = unlockRelicInProgress(this.progress, relic.id, methodLabel);
    this.progress = res.progress;

    let totalJades = res.newlyDiscovered ? baseJades : 0;
    const bonusClaim = claimFullPlanetBonus(this.progress, relic.planetId);
    this.progress = bonusClaim.progress;
    let planetBonusNote = '';
    if (bonusClaim.awarded) {
      totalJades += bonusClaim.bonusJades;
      planetBonusNote = `Selamat! Seluruh ${bonusClaim.total} artefak di planet ini telah terkumpul (+${bonusClaim.bonusJades} Stellar Jades bonus koleksi penuh)!`;
    }

    this.persist();
    if (totalJades > 0) {
      this.bridge.addJades(totalJades);
    }
    if (res.newlyDiscovered) {
      this.currentPlayerHp = Math.min(100, this.currentPlayerHp + 15);
    }
    this.bridge.playSfx?.('reward');
    this.renderPlanetTabs();
    this.syncHudBars();

    const catColor = CATEGORY_COLORS[relic.category];
    const catLabel = CATEGORY_LABELS[relic.category];
    const rarityColor = RARITY_COLORS[relic.rarity];
    const rarityLabel = RARITY_LABELS[relic.rarity];
    const tier = getRelicTier(relic);
    const tierLabel = TIER_LABELS[tier];
    const tierColor = TIER_COLORS[tier];
    if (res.newlyDiscovered) {
      this.engine?.triggerCelebration(catColor);
    }
    const stats = getCodexStats(this.progress);
    const pStat = stats.byPlanet[relic.planetId];
    const planetInfo = getPlanetById(relic.planetId);
    const activeHero = getRpgCharacterProfile(this.bridge.getHeroId());

    this.openEncounterModal(`
      <div class="exp-discovery-burst" style="display: flex; flex-direction: column; gap: 14px;">
        <div style="display: flex; gap: 16px; align-items: center; flex-wrap: wrap; background: radial-gradient(circle at 18% 50%, ${catColor}26, rgba(10,14,34,0.88) 70%); padding: 14px; border-radius: 14px; border: 1px solid ${catColor}55;">
          <div style="flex-shrink: 0; border-radius: 16px; box-shadow: 0 0 30px ${catColor}55;">
            ${renderRelicSvg(relic.artKey, relic.category, 108)}
          </div>
          <div style="flex: 1; min-width: 210px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-size: 0.74rem; font-weight: 700; letter-spacing: 0.06em; color: ${catColor};">
                ${res.newlyDiscovered ? 'PENEMUAN ARTEFAK BARU' : 'ARSIP ASTRAL CODEX'} · ${catLabel}
              </span>
              <span style="font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${rarityColor}24; border: 1px solid ${rarityColor}; color: ${rarityColor};">
                ${rarityLabel}
              </span>
              <span style="font-size: 0.66rem; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${tierColor}1a; border: 1px solid ${tierColor}88; color: ${tierColor};">
                ${tierLabel}
              </span>
              ${
                relic.isConceptualCreation
                  ? `<span style="font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; background: rgba(247,217,150,0.16); border: 1px solid rgba(247,217,150,0.6); color: #f7d996;">KREASI KONSEPTUAL GLOKALISASI</span>`
                  : ''
              }
            </div>
            <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0; font-size: 1.35rem; color: #f7d996;">${relic.name}</h3>
            <div style="font-size: 0.84rem; color: #cbd5e1;">Asal / Konteks: <strong>${relic.origin}</strong> · ${relic.subCategory}</div>
            <div style="margin-top: 4px; font-size: 0.82rem; color: #e2e8f0;">${relic.shortHint}</div>
            <div style="margin-top: 6px; font-size: 0.85rem; font-weight: 700; color: #34d399;">
              ${totalJades > 0 ? `+${totalJades} Stellar Jades diperoleh!` : 'Sudah tercatat di Astral Codex'}
            </div>
          </div>
        </div>

        ${
          relic.isConceptualCreation
            ? `<div class="hsr-panel-inner" style="padding: 9px 12px; font-size: 0.82rem; color: #fde68a; border-color: rgba(247,217,150,0.45);">
                Catatan Edukasi: Benda ini merupakan <strong>kreasi konseptual glokalisasi dalam dunia game</strong> untuk menggambarkan perpaduan budaya lokal dan inovasi modern.
              </div>`
            : ''
        }
        ${extraNote ? `<div class="hsr-panel-inner" style="padding: 10px 12px; font-size: 0.88rem; color: #fde68a;">${extraNote}</div>` : ''}
        ${planetBonusNote ? `<div class="hsr-panel-inner" style="padding: 10px 12px; font-size: 0.88rem; color: #34d399; border-color: #34d399;">${planetBonusNote}</div>` : ''}

        <div class="hsr-panel-inner" style="padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; font-size: 0.9rem; line-height: 1.52;">
          <div><strong style="color: #f7d996;">Sejarah &amp; Makna Budaya:</strong> ${relic.history}</div>
          <div><strong style="color: #38bdf8;">Hubungan dengan Glokalisasi:</strong> ${relic.glocalizationLink}</div>
          <div><strong style="color: #c084fc;">Fakta Menarik:</strong> ${relic.funFact}</div>
          <div style="display: flex; flex-wrap: wrap; gap: 14px; font-size: 0.82rem; color: #94a3b8;">
            <span>Progres ${planetInfo.name.replace(/^Planet \d+ — /, '')}: <strong class="tabular-nums" style="color: #f7d996;">${pStat.found} / ${pStat.total}</strong></span>
            <span>Total Astral Codex: <strong class="tabular-nums" style="color: #f8fafc;">${stats.totalFound} / ${stats.totalRelics} (${stats.completionPct}%)</strong></span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 10px; background: rgba(13, 18, 44, 0.85); border: 1px solid ${activeHero.accentColor}44;">
          <img src="${activeHero.portraitUrl}" alt="${activeHero.name}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; object-position: center top; border: 1.5px solid ${activeHero.accentColor}; flex-shrink: 0;" />
          <div style="font-size: 0.8rem; color: #e2e8f0;">
            <strong style="color: ${activeHero.accentColor};">${activeHero.name}</strong> · ${activeHero.roleBadge}
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
          <button id="btn-enc-open-codex" class="hsr-btn-secondary" type="button">Lihat Astral Codex</button>
          <button id="btn-enc-done" class="hsr-btn-primary" type="button">Simpan ke Astral Codex</button>
        </div>
      </div>
    `);

    document.getElementById('btn-enc-done')?.addEventListener('click', () => this.closeEncounterModal());
    document.getElementById('btn-enc-open-codex')?.addEventListener('click', () => {
      document.getElementById('modal-exp-encounter')?.classList.add('hidden');
      this.openAstralCodex(relic.category);
    });
  }

  private openSpotEncounter(spotId: string) {
    const spot = SPOT_ENCOUNTERS.find((s) => s.id === spotId);
    if (!spot) return this.closeEncounterModal();

    const alreadyCollected = this.progress.inspectedSpots.includes(spot.id);
    if (alreadyCollected) {
      return this.awardRelicAndShowPanel(spot.rewardRelicId, `Memeriksa ${spot.label}`, 0, spot.inspectText);
    }

    const access = evaluateSpotAccess(spot, this.progress, this.engine?.getDefeatedWispIds() || []);
    if (!access.accessible) {
      if (access.reason === 'guarded') {
        this.bridge.playSfx?.('wrong');
        this.openEncounterModal(`
          <div>
            <div style="font-size: 0.76rem; font-weight: 700; color: #c084fc;">ARTEFAK DIJAGA ANOMALI VOID</div>
            <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.25rem;">${spot.label}</h3>
            <p style="margin: 0 0 12px; color: #cbd5e1; line-height: 1.5;">
              Gelombang energi <strong>Cultural Void</strong> menyelimuti titik penemuan di <strong>${spot.landmark}</strong>!
              Dekati Anomali Void ungu di sekitar sini lalu tekan <strong style="color: #fda4af;">Serang [X]</strong> untuk membersihkannya terlebih dahulu.
            </p>
            <div style="display: flex; justify-content: flex-end;">
              <button id="btn-enc-cancel" class="hsr-btn-primary" type="button">Siap Bertarung</button>
            </div>
          </div>
        `);
        document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
        return;
      }

      if (access.reason === 'gated') {
        this.bridge.playSfx?.('wrong');
        const planetName = getPlanetById(spot.planetId).name.replace(/^Planet \d+ — /, '');
        this.openEncounterModal(`
          <div>
            <div style="font-size: 0.76rem; font-weight: 700; color: #f59e0b;">AREA TERKUNCI · ${spot.landmark.toUpperCase()}</div>
            <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.25rem;">${spot.label}</h3>
            <p style="margin: 0 0 12px; color: #cbd5e1; line-height: 1.5;">
              Segel area rahasia di <strong>${planetName}</strong> baru dapat dibuka setelah kamu mengumpulkan minimal
              <strong style="color: #f7d996;">${access.requiredRelics} koleksi</strong> di planet ini.
            </p>
            <div class="hsr-panel-inner" style="padding: 10px 12px; font-size: 0.88rem;">
              Progres koleksi planet ini: <strong class="tabular-nums" style="color: #34d399;">${access.foundRelics} / ${access.requiredRelics}</strong>
              (kurang ${access.missingRelics} lagi)
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
              <button id="btn-enc-cancel" class="hsr-btn-primary" type="button">Kembali Menjelajah</button>
            </div>
          </div>
        `);
        document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
        return;
      }
    }

    if (spot.guardianChallengeHeroId && spot.challengeQuestion && spot.challengeOptions) {
      const challenger = getRpgCharacterProfile(spot.guardianChallengeHeroId);
      const activePower = getGuardianPower(this.bridge.getHeroId());
      const shuffled = shuffleOptionsKeepAnswer(spot.challengeOptions, spot.challengeCorrect || 0);
      let usedHint = false;

      this.openEncounterModal(`
        <div>
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
            <img src="${challenger.portraitUrl}" alt="${challenger.name}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; object-position: center top; border: 2px solid ${challenger.accentColor}; flex-shrink: 0;" />
            <div>
              <div style="font-size: 0.74rem; font-weight: 800; color: ${challenger.accentColor};">TANTANGAN KHUSUS PENJAGA · ${challenger.name.toUpperCase()}</div>
              <h3 id="exp-enc-title" class="font-display" style="margin: 2px 0 0; font-size: 1.22rem;">${spot.challengeTitle || spot.label}</h3>
            </div>
          </div>
          <div class="hsr-panel-inner" style="padding: 12px 14px; font-weight: 600; margin-bottom: 12px;">${spot.challengeQuestion}</div>
          <div id="exp-spot-choices" style="display: flex; flex-direction: column; gap: 8px;"></div>
          <div id="exp-spot-feedback" style="margin-top: 10px; font-size: 0.88rem; color: #fde68a;"></div>
          <div id="exp-spot-hints" style="margin-top: 10px;"></div>
          <div style="display: flex; justify-content: space-between; margin-top: 12px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; gap: 8px;">
              ${
                activePower.riddleHintCharges > 0
                  ? `<button id="btn-spot-sampo" class="hsr-btn-secondary" type="button" style="min-height: 38px; padding: 6px 10px; font-size: 0.8rem; border-color: #6ee7b7; color: #6ee7b7;">Kunci Sampo</button>`
                  : ''
              }
            </div>
            <button id="btn-enc-cancel" class="hsr-btn-secondary" type="button">Tutup</button>
          </div>
        </div>
      `);

      const choicesBox = document.getElementById('exp-spot-choices');
      const fb = document.getElementById('exp-spot-feedback');
      shuffled.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'exp-choice-btn';
        btn.dataset.idx = String(idx);
        btn.textContent = opt;
        btn.addEventListener('click', () => {
          if (idx === shuffled.correctIndex) {
            this.progress.inspectedSpots.push(spot.id);
            this.persist();
            const reward = spot.rewardJades + activePower.bonusQuizJades;
            this.awardRelicAndShowPanel(
              spot.rewardRelicId,
              spot.challengeTitle || `Tantangan ${challenger.name}`,
              reward,
              spot.challengeExplanation || spot.inspectText
            );
          } else {
            this.bridge.playSfx?.('wrong');
            btn.disabled = true;
            btn.style.borderColor = '#e11d48';
            if (fb) fb.textContent = spot.challengeHint || 'Belum tepat, perhatikan prinsip glokalisasi lalu coba lagi!';
          }
        });
        choicesBox?.appendChild(btn);
      });

      this.mountGraduatedHintBox('exp-spot-hints', getGraduatedHintsForEncounter(spot.id, spot.challengeHint));
      document.getElementById('btn-spot-sampo')?.addEventListener('click', (e) => {
        if (usedHint || !choicesBox) return;
        usedHint = true;
        (e.currentTarget as HTMLButtonElement).disabled = true;
        const buttons = Array.from(choicesBox.querySelectorAll('button')) as HTMLButtonElement[];
        const wrongBtn = buttons.find((b) => Number(b.dataset.idx) !== shuffled.correctIndex && !b.disabled);
        if (wrongBtn) {
          wrongBtn.disabled = true;
          wrongBtn.style.opacity = '0.35';
        }
      });
      document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
      return;
    }

    this.progress.inspectedSpots.push(spot.id);
    this.persist();
    this.awardRelicAndShowPanel(spot.rewardRelicId, `Memeriksa ${spot.label}`, spot.rewardJades, spot.inspectText);
  }

  private openChestEncounter(chestId: string) {
    const chest = CHEST_ENCOUNTERS.find((c) => c.id === chestId);
    if (!chest) return this.closeEncounterModal();

    if (this.progress.openedChests.includes(chest.id)) {
      return this.awardRelicAndShowPanel(chest.rewardRelicId, chest.label, 0, 'Peti ini sudah pernah kamu buka sebelumnya.');
    }

    if (!chest.requiresQuiz || !chest.quizQuestion || !chest.options) {
      this.progress.openedChests.push(chest.id);
      this.persist();
      return this.awardRelicAndShowPanel(
        chest.rewardRelicId,
        `Membuka ${chest.label}`,
        chest.rewardJades,
        'Peti rahasia berhasil dibuka! Di dalamnya tersimpan peninggalan berharga.'
      );
    }

    const shuffled = shuffleOptionsKeepAnswer(chest.options, chest.correctIndex || 0);
    const power = getGuardianPower(this.bridge.getHeroId());
    let usedHint = false;

    this.openEncounterModal(`
      <div>
        <div style="font-size: 0.76rem; font-weight: 700; color: #f7d996;">PETI TERSEMBUNYI · ${chest.landmark}</div>
        <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.25rem;">${chest.label}</h3>
        <p style="margin: 0 0 12px; color: #cbd5e1;">Kunci budaya melindungi peti ini. Jawab pertanyaan berikut untuk membukanya!</p>
        <div class="hsr-panel-inner" style="padding: 12px 14px; font-weight: 600; margin-bottom: 12px;">${chest.quizQuestion}</div>
        <div id="exp-chest-choices" style="display: flex; flex-direction: column; gap: 8px;"></div>
        <div id="exp-chest-feedback" style="margin-top: 10px; font-size: 0.88rem;"></div>
        <div id="exp-chest-hints" style="margin-top: 10px;"></div>
        <div style="display: flex; justify-content: space-between; margin-top: 12px; flex-wrap: wrap; gap: 8px;">
          ${
            power.riddleHintCharges > 0
              ? `<button id="btn-sampo-hint" class="hsr-btn-secondary" type="button" style="border-color: #6ee7b7; color: #6ee7b7;">Petunjuk Sampo (Hapus 1 Opsi Salah)</button>`
              : '<span></span>'
          }
          <button id="btn-enc-cancel" class="hsr-btn-secondary" type="button">Tutup</button>
        </div>
      </div>
    `);

    const choicesBox = document.getElementById('exp-chest-choices');
    const fb = document.getElementById('exp-chest-feedback');
    shuffled.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'exp-choice-btn';
      btn.dataset.idx = String(idx);
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if (idx === shuffled.correctIndex) {
          this.progress.openedChests.push(chest.id);
          this.persist();
          const reward = chest.rewardJades + power.bonusQuizJades;
          this.awardRelicAndShowPanel(chest.rewardRelicId, `Membuka ${chest.label}`, reward, chest.explanation);
        } else {
          this.bridge.playSfx?.('wrong');
          btn.disabled = true;
          btn.style.borderColor = '#e11d48';
          if (fb) {
            fb.innerHTML = `<span style="color: #fda4af;">Kurang tepat! Coba amati petunjuk daerah dan ciri bendanya, lalu pilih lagi.</span>`;
          }
        }
      });
      choicesBox?.appendChild(btn);
    });

    this.mountGraduatedHintBox('exp-chest-hints', getGraduatedHintsForEncounter(chest.id, chest.explanation));
    document.getElementById('btn-sampo-hint')?.addEventListener('click', (e) => {
      if (usedHint || !choicesBox) return;
      usedHint = true;
      (e.currentTarget as HTMLButtonElement).disabled = true;
      const buttons = Array.from(choicesBox.querySelectorAll('button')) as HTMLButtonElement[];
      const wrongBtn = buttons.find((b) => Number(b.dataset.idx) !== shuffled.correctIndex && !b.disabled);
      if (wrongBtn) {
        wrongBtn.disabled = true;
        wrongBtn.style.opacity = '0.35';
      }
    });
    document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
  }

  private openNpcEncounter(npcId: string) {
    const npc = NPC_ENCOUNTERS.find((n) => n.id === npcId);
    if (!npc) return this.closeEncounterModal();

    if (this.progress.solvedNpcs.includes(npc.id)) {
      return this.awardRelicAndShowPanel(npc.rewardRelicId, `Misi ${npc.name}`, 0, npc.explanation);
    }

    const shuffled = shuffleOptionsKeepAnswer(npc.options, npc.correctIndex);
    const power = getGuardianPower(this.bridge.getHeroId());
    const heroProf = getRpgCharacterProfile(this.bridge.getHeroId());
    let usedHint = false;

    this.openEncounterModal(`
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px;">
          <div>
            <div style="font-size: 0.76rem; font-weight: 700; letter-spacing: 0.04em; color: ${npc.accentColor};">TEKA-TEKI NPC · ${npc.role}</div>
            <h3 id="exp-enc-title" class="font-display" style="margin: 2px 0 0; font-size: 1.25rem;">${npc.name}</h3>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; padding: 5px 10px; border-radius: 10px; background: rgba(9, 13, 30, 0.86); border: 1px solid ${heroProf.accentColor}55;">
            <img src="${heroProf.portraitUrl}" alt="${heroProf.name}" style="width: 34px; height: 34px; border-radius: 50%; object-fit: cover; object-position: center top; border: 1.5px solid ${heroProf.accentColor};" />
            <div style="font-size: 0.74rem; line-height: 1.25;">
              <div style="font-weight: 700; color: ${heroProf.accentColor};">${heroProf.name}</div>
              <div style="color: #94a3b8;">${heroProf.roleBadge}</div>
            </div>
          </div>
        </div>
        <p style="margin: 0 0 10px; color: #cbd5e1; font-style: italic;">"${npc.greeting}"</p>
        <div class="hsr-panel-inner" style="padding: 12px 14px; font-weight: 600; margin-bottom: 12px;">${npc.riddleQuestion}</div>
        <div id="exp-npc-choices" style="display: flex; flex-direction: column; gap: 8px;"></div>
        <div id="exp-npc-feedback" style="margin-top: 10px; font-size: 0.88rem; color: #fde68a;"></div>
        <div id="exp-npc-hints" style="margin-top: 10px;"></div>
        <div style="display: flex; justify-content: space-between; margin-top: 12px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; gap: 8px;">
            ${
              power.riddleHintCharges > 0
                ? `<button id="btn-npc-sampo" class="hsr-btn-secondary" type="button" style="min-height: 38px; padding: 6px 10px; font-size: 0.8rem; border-color: #6ee7b7; color: #6ee7b7;">Kunci Sampo</button>`
                : ''
            }
          </div>
          <button id="btn-enc-cancel" class="hsr-btn-secondary" type="button">Nanti Saja</button>
        </div>
      </div>
    `);

    const choicesBox = document.getElementById('exp-npc-choices');
    const fb = document.getElementById('exp-npc-feedback');

    shuffled.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'exp-choice-btn';
      btn.dataset.idx = String(idx);
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        if (idx === shuffled.correctIndex) {
          this.progress.solvedNpcs.push(npc.id);
          this.persist();
          const reward = npc.rewardJades + power.bonusQuizJades;
          this.awardRelicAndShowPanel(npc.rewardRelicId, `Misi NPC: ${npc.name}`, reward, npc.explanation);
        } else {
          this.bridge.playSfx?.('wrong');
          btn.disabled = true;
          btn.style.borderColor = '#e11d48';
          if (fb) fb.textContent = `Belum tepat. Gunakan Petunjuk Bertahap di bawah jika butuh bantuan!`;
        }
      });
      choicesBox?.appendChild(btn);
    });

    this.mountGraduatedHintBox('exp-npc-hints', getGraduatedHintsForEncounter(npc.id, npc.hintText));
    document.getElementById('btn-npc-sampo')?.addEventListener('click', (e) => {
      if (usedHint || !choicesBox) return;
      usedHint = true;
      (e.currentTarget as HTMLButtonElement).disabled = true;
      const buttons = Array.from(choicesBox.querySelectorAll('button')) as HTMLButtonElement[];
      const wrongBtn = buttons.find((b) => Number(b.dataset.idx) !== shuffled.correctIndex && !b.disabled);
      if (wrongBtn) {
        wrongBtn.disabled = true;
        wrongBtn.style.opacity = '0.35';
      }
    });
    document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
  }

  private openPuzzleEncounter(puzzleId: string) {
    const puzzle = PUZZLE_ENCOUNTERS.find((p) => p.id === puzzleId);
    if (!puzzle) return this.closeEncounterModal();

    if (this.progress.solvedPuzzles.includes(puzzle.id)) {
      return this.awardRelicAndShowPanel(puzzle.rewardRelicId, puzzle.title, 0, puzzle.explanation);
    }

    const power = getGuardianPower(this.bridge.getHeroId());
    const shuffledMatches = [...puzzle.matchPool].sort(() => Math.random() - 0.5);

    this.openEncounterModal(`
      <div>
        <div style="font-size: 0.76rem; font-weight: 700; color: #c084fc;">TEKA-TEKI PENCOCOKAN BUDAYA · ${puzzle.landmark}</div>
        <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px; font-size: 1.25rem;">${puzzle.title}</h3>
        <p style="margin: 0 0 12px; color: #cbd5e1;">${puzzle.prompt}</p>
        <div id="exp-puzzle-rows" style="display: flex; flex-direction: column; gap: 10px;">
          ${puzzle.pairs
            .map(
              (pair, idx) => `
            <div class="hsr-panel-inner" style="padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 48px; height: 48px; flex-shrink: 0;">${renderRelicSvg(pair.artKey, 'local', 48)}</div>
                <strong style="font-size: 0.92rem;">${pair.label}</strong>
              </div>
              <select class="exp-puzzle-select" data-pair-idx="${idx}" aria-label="Pilih pasangan untuk ${pair.label}"
                style="padding: 8px 10px; border-radius: 8px; background: #0b1026; color: #f4f6fb; border: 1px solid rgba(229,184,105,0.45); font-size: 0.88rem; min-width: 210px;">
                <option value="">-- Pilih Pasangan --</option>
                ${shuffledMatches.map((m) => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </div>`
            )
            .join('')}
        </div>
        <div id="exp-puzzle-feedback" style="margin-top: 10px; font-size: 0.88rem;"></div>
        <div id="exp-puzzle-hints" style="margin-top: 10px;"></div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px;">
          <button id="btn-enc-cancel" class="hsr-btn-secondary" type="button">Tutup</button>
          <button id="btn-puzzle-check" class="hsr-btn-primary" type="button">Periksa Jawaban</button>
        </div>
      </div>
    `);

    this.mountGraduatedHintBox('exp-puzzle-hints', getGraduatedHintsForEncounter(puzzle.id, puzzle.explanation));

    document.getElementById('btn-puzzle-check')?.addEventListener('click', () => {
      const selects = Array.from(document.querySelectorAll('.exp-puzzle-select')) as HTMLSelectElement[];
      const allMatched = puzzle.pairs.every((pair, idx) => selects[idx]?.value === pair.correctMatch);
      const fb = document.getElementById('exp-puzzle-feedback');
      if (allMatched) {
        this.progress.solvedPuzzles.push(puzzle.id);
        this.persist();
        const reward = puzzle.rewardJades + power.bonusQuizJades;
        this.awardRelicAndShowPanel(puzzle.rewardRelicId, puzzle.title, reward, puzzle.explanation);
      } else {
        this.bridge.playSfx?.('wrong');
        if (fb) {
          fb.innerHTML = `<span style="color: #fda4af;">Masih ada pasangan yang keliru. Periksa kembali gambar dan asal budaya setiap benda!</span>`;
        }
      }
    });
    document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
  }

  private openBossEncounter(bossId: string) {
    const planetId = this.progress.activePlanet;
    const boss = BOSS_ENCOUNTERS[planetId];
    if (!boss || boss.id !== bossId) return this.closeEncounterModal();

    if (this.progress.defeatedBosses.includes(boss.id)) {
      return this.awardRelicAndShowPanel(boss.rewardRelicId, `Penjaga ${boss.name}`, 0, boss.defeatLine);
    }

    const req = canChallengePlanetBoss(this.progress, planetId);
    if (!req.allowed) {
      this.openEncounterModal(`
        <div>
          <div style="font-size: 0.76rem; font-weight: 700; color: #fda4af;">SEGEL PENJAGA PLANET</div>
          <h3 id="exp-enc-title" class="font-display" style="margin: 4px 0 8px;">${boss.name}</h3>
          <p style="margin: 0 0 12px; color: #cbd5e1;">
            ${boss.title} hanya akan bertarung setelah kamu mengumpulkan minimal
            <strong style="color: #f7d996;">${req.requiredCount} artefak</strong> di planet ini.
          </p>
          <div class="hsr-panel-inner" style="padding: 12px; font-size: 0.9rem;">
            Progres saat ini: <strong class="tabular-nums" style="color: #34d399;">${req.foundCount} / ${req.requiredCount}</strong> artefak ditemukan.
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 14px;">
            <button id="btn-enc-cancel" class="hsr-btn-primary" type="button">Kembali Menjelajah</button>
          </div>
        </div>
      `);
      document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
      return;
    }

    const power = getGuardianPower(this.bridge.getHeroId());
    const heroProf = getRpgCharacterProfile(this.bridge.getHeroId());
    let round = 0;
    let bossHp = 100;
    let shieldLeft = power.bossShieldCharges;

    const renderRound = () => {
      const q = boss.questions[round];
      const shuffled = shuffleOptionsKeepAnswer(q.options, q.correct);
      this.openEncounterModal(`
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
            <div>
              <div style="font-size: 0.76rem; font-weight: 700; color: #fb7185;">PERTEMPURAN PENJAGA PLANET · BABAK ${round + 1}/${boss.questions.length}</div>
              <h3 id="exp-enc-title" class="font-display" style="margin: 2px 0;">${boss.name}</h3>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <img src="${heroProf.portraitUrl}" alt="${heroProf.name}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; object-position: center top; border: 2px solid ${heroProf.accentColor};" />
              <div class="tabular-nums" style="font-size: 0.84rem; font-weight: 700; color: #34d399;">
                HP Pemain: ${this.currentPlayerHp}/100 · HP Lawan: ${bossHp}%
              </div>
            </div>
          </div>
          <p style="margin: 8px 0; font-size: 0.86rem; color: #fda4af; font-style: italic;">"${boss.introLine}"</p>
          ${shieldLeft > 0 ? `<div style="font-size: 0.8rem; color: #ddd6fe; margin-bottom: 6px;">Perisai Epistemik Nihilux Aktif: Menahan ${shieldLeft} kesalahan!</div>` : ''}
          <div class="hsr-panel-inner" style="padding: 12px 14px; font-weight: 600; margin-bottom: 12px;">${q.q}</div>
          <div id="exp-boss-choices" style="display: flex; flex-direction: column; gap: 8px;"></div>
          <div id="exp-boss-feedback" style="margin-top: 10px; font-size: 0.88rem;"></div>
          <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
            <button id="btn-enc-cancel" class="hsr-btn-secondary" type="button">Mundur</button>
          </div>
        </div>
      `);

      const choicesBox = document.getElementById('exp-boss-choices');
      const fb = document.getElementById('exp-boss-feedback');

      shuffled.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'exp-choice-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
          if (idx === shuffled.correctIndex) {
            this.bridge.playSfx?.('break');
            bossHp = Math.max(0, Math.round(100 - ((round + 1) / boss.questions.length) * 100));
            round += 1;
            if (round >= boss.questions.length) {
              const bossRes = completePlanetBoss(this.progress, planetId);
              this.progress = bossRes.progress;
              this.persist();
              if (bossRes.rewardJades > 0) {
                this.bridge.addJades(bossRes.rewardJades);
              }
              this.currentPlayerHp = 100;
              const unlockMsg = bossRes.unlockedNextPlanet
                ? `${boss.defeatLine} Planet baru terbuka: ${getPlanetById(bossRes.unlockedNextPlanet).name}!`
                : boss.defeatLine;
              this.awardRelicAndShowPanel(boss.rewardRelicId, `Mengalahkan ${boss.name}`, 0, unlockMsg);
            } else {
              renderRound();
            }
          } else {
            this.bridge.playSfx?.('wrong');
            if (shieldLeft > 0) {
              shieldLeft -= 1;
              if (fb) fb.innerHTML = `<span style="color: #ddd6fe;">Perisai Epistemik Nihilux menyerap serangan! ${q.exp}</span>`;
            } else {
              this.currentPlayerHp = Math.max(20, this.currentPlayerHp - 20);
              if (fb) fb.innerHTML = `<span style="color: #fda4af;">Serangan balik (-20 HP)! ${q.exp}</span>`;
            }
          }
        });
        choicesBox?.appendChild(btn);
      });
      document.getElementById('btn-enc-cancel')?.addEventListener('click', () => this.closeEncounterModal());
    };

    renderRound();
  }

  private renderCodexModal() {
    const card = document.getElementById('astral-codex-card');
    if (!card) return;
    const stats = getCodexStats(this.progress);
    const foundSet = new Set(this.progress.discoveredRelics);

    const filterBtns: { id: 'all' | RelicCategory | 'history' | 'theory'; label: string }[] = [
      { id: 'all', label: `Semua (${stats.totalFound}/${stats.totalRelics})` },
      { id: 'local', label: `Local Relics (${stats.byCategory.local.found}/${stats.byCategory.local.total})` },
      { id: 'global', label: `Global Relics (${stats.byCategory.global.found}/${stats.byCategory.global.total})` },
      { id: 'glocal', label: `Glocal Relics (${stats.byCategory.glocal.found}/${stats.byCategory.glocal.total})` },
      { id: 'lost', label: `Lost Knowledge (${stats.byCategory.lost.found}/${stats.byCategory.lost.total})` },
      { id: 'history', label: 'Riwayat Penemuan' },
      { id: 'theory', label: 'Teori Glokalisasi' },
    ];

    let bodyHtml = '';
    if (this.codexFilter === 'history') {
      bodyHtml = this.progress.discoveryLog.length
        ? `<div style="display: flex; flex-direction: column; gap: 8px;">
            ${this.progress.discoveryLog
              .map((log) => {
                const r = getRelicById(log.relicId);
                return `<div class="hsr-panel-inner" style="padding: 10px 12px; display: flex; justify-content: space-between; gap: 8px;">
                  <div><strong>${r?.name || log.relicId}</strong> · <span style="color: #cbd5e1;">${log.method}</span></div>
                  <span class="tabular-nums" style="color: #94a3b8; font-size: 0.82rem;">${log.timestamp}</span>
                </div>`;
              })
              .join('')}
          </div>`
        : `<p style="color: #cbd5e1;">Belum ada artefak ditemukan. Jelajahi Terra Nusantara untuk memulai catatan Astral Codex!</p>`;
    } else if (this.codexFilter === 'theory') {
      const theories = this.bridge.getTheoryCodex?.() || [];
      bodyHtml = `<div style="display: flex; flex-direction: column; gap: 10px;">
        ${theories
          .map(
            (t) => `<div class="hsr-panel-inner" style="padding: 12px 14px;">
            <div style="font-size: 0.76rem; color: #e5b869; font-weight: 700;">${t.origin}</div>
            <div class="font-display" style="font-size: 1rem; font-weight: 700; margin: 2px 0 4px;">${t.term}</div>
            <p style="margin: 0; font-size: 0.88rem; color: #cbd5e1;">${t.summary}</p>
          </div>`
          )
          .join('')}
      </div>`;
    } else {
      const filteredRelics = RELICS.filter((r) => {
        if (this.codexFilter !== 'all' && r.category !== this.codexFilter) return false;
        if (this.codexPlanetFilter !== 'all' && r.planetId !== this.codexPlanetFilter) return false;
        return true;
      });

      const detailRelic: RelicItem | undefined =
        this.selectedCodexRelicId && foundSet.has(this.selectedCodexRelicId)
          ? getRelicById(this.selectedCodexRelicId)
          : undefined;

      const detailBox = detailRelic
        ? `<div class="hsr-panel-inner" style="padding: 14px; border-color: ${CATEGORY_COLORS[detailRelic.category]}; display: flex; gap: 14px; flex-wrap: wrap; align-items: center;">
            <div style="flex-shrink: 0;">${renderRelicSvg(detailRelic.artKey, detailRelic.category, 88)}</div>
            <div style="flex: 1; min-width: 220px; font-size: 0.88rem; display: flex; flex-direction: column; gap: 5px; line-height: 1.48;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-weight: 800; font-size: 1.08rem; color: #f7d996;">${detailRelic.name} (${detailRelic.origin})</span>
                <span style="font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${RARITY_COLORS[detailRelic.rarity]}24; border: 1px solid ${RARITY_COLORS[detailRelic.rarity]}; color: ${RARITY_COLORS[detailRelic.rarity]};">${RARITY_LABELS[detailRelic.rarity]}</span>
                <span style="font-size: 0.66rem; font-weight: 800; padding: 2px 7px; border-radius: 6px; background: ${TIER_COLORS[getRelicTier(detailRelic)]}1a; border: 1px solid ${TIER_COLORS[getRelicTier(detailRelic)]}88; color: ${TIER_COLORS[getRelicTier(detailRelic)]};">${TIER_LABELS[getRelicTier(detailRelic)]}</span>
                ${detailRelic.isConceptualCreation ? `<span style="font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; background: rgba(247,217,150,0.16); border: 1px solid rgba(247,217,150,0.55); color: #f7d996;">KREASI KONSEPTUAL</span>` : ''}
              </div>
              <div style="color: #e2e8f0;">${detailRelic.shortHint}</div>
              <div><strong>Sejarah &amp; Budaya:</strong> ${detailRelic.history}</div>
              <div><strong style="color: #38bdf8;">Kaitan Glokalisasi:</strong> ${detailRelic.glocalizationLink}</div>
              <div><strong style="color: #c084fc;">Fakta Menarik:</strong> ${detailRelic.funFact}</div>
            </div>
          </div>`
        : '';

      bodyHtml = `
        <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
          <span style="font-size: 0.78rem; color: #94a3b8;">Filter Planet:</span>
          <button type="button" class="hsr-btn-secondary exp-codex-planet" data-planet="all" style="min-height: 32px; padding: 4px 10px; font-size: 0.78rem; ${this.codexPlanetFilter === 'all' ? 'border-color: #f7d996; color: #f7d996;' : ''}">Semua</button>
          ${PLANETS.map(
            (p) => `<button type="button" class="hsr-btn-secondary exp-codex-planet" data-planet="${p.id}" style="min-height: 32px; padding: 4px 10px; font-size: 0.78rem; ${this.codexPlanetFilter === p.id ? 'border-color: #f7d996; color: #f7d996;' : ''}">${p.name.replace(/^Planet \d+ — /, '')}</button>`
          ).join('')}
        </div>
        ${detailBox}
        <div class="exp-codex-grid">
          ${filteredRelics
            .map((r) => {
              const unlocked = foundSet.has(r.id);
              const planetName = getPlanetById(r.planetId).name.replace(/^Planet \d+ — /, '');
              const rarCol = RARITY_COLORS[r.rarity];
              const tier = getRelicTier(r);
              return `<button type="button" class="exp-relic-card${unlocked ? ' is-unlocked' : ''}" data-relic-id="${r.id}" ${unlocked ? '' : 'disabled'}>
                <div>${unlocked ? renderRelicSvg(r.artKey, r.category, 74) : renderLockedRelicSvg(r.category, r.artKey)}</div>
                <div style="font-weight: 700; font-size: 0.85rem; text-align: center; color: ${unlocked ? '#f7d996' : '#94a3b8'};">
                  ${unlocked ? r.name : 'Siluet Artefak (???)'}
                </div>
                <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: center;">
                  <span style="font-size: 0.64rem; font-weight: 800; padding: 1px 6px; border-radius: 5px; border: 1px solid ${rarCol}88; color: ${rarCol};">${RARITY_LABELS[r.rarity]}</span>
                  <span style="font-size: 0.6rem; font-weight: 700; padding: 1px 5px; border-radius: 5px; border: 1px solid ${TIER_COLORS[tier]}66; color: ${TIER_COLORS[tier]};">${tier === 'utama' ? 'Utama' : tier === 'tersembunyi' ? 'Rahasia' : 'Arsip'}</span>
                  ${unlocked && r.isConceptualCreation ? `<span style="font-size: 0.62rem; font-weight: 700; padding: 1px 5px; border-radius: 5px; border: 1px solid rgba(247,217,150,0.5); color: #f7d996;">Konseptual</span>` : ''}
                </div>
                <div style="font-size: 0.72rem; color: ${CATEGORY_COLORS[r.category]}; text-align: center;">
                  ${unlocked ? `${r.origin} · Klik Detail` : `Wilayah: ${planetName}`}
                </div>
              </button>`;
            })
            .join('')}
        </div>`;
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
        <div>
          <div style="font-size: 0.74rem; font-weight: 700; color: #f7d996;">ENSIKLOPEDIA KOLEKSI ASTRALVERSE</div>
          <h3 id="astral-codex-title" class="font-display" style="margin: 2px 0 0; font-size: 1.35rem;">Astral Codex</h3>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="tabular-nums" style="font-size: 0.9rem; font-weight: 700; color: #34d399;">
            Kelengkapan: ${stats.totalFound}/${stats.totalRelics} (${stats.completionPct}%)
          </div>
          <button id="btn-astral-codex-close" class="icon-btn" type="button" aria-label="Tutup Astral Codex">✕</button>
        </div>
      </div>

      <div style="height: 8px; border-radius: 999px; background: rgba(255,255,255,0.08); overflow: hidden;">
        <div style="height: 100%; width: ${stats.completionPct}%; background: linear-gradient(90deg, #34d399, #f7d996); transition: width 240ms ease;"></div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
        ${PLANETS.map((p) => {
          const pInfo = stats.byPlanet[p.id];
          const pct = pInfo.total > 0 ? Math.round((pInfo.found / pInfo.total) * 100) : 0;
          return `<button type="button" class="hsr-panel-inner exp-codex-planet" data-planet="${p.id}" style="padding: 8px 12px; text-align: left; cursor: pointer; border-color: ${
            this.codexPlanetFilter === p.id ? p.accentColor : 'rgba(255,255,255,0.12)'
          };">
            <div style="font-size: 0.7rem; color: ${p.accentColor}; font-weight: 700;">${p.name.replace(/^Planet \d+ — /, '').toUpperCase()}</div>
            <div class="tabular-nums" style="font-size: 1.02rem; font-weight: 800; color: #f8fafc;">${pInfo.found}/${pInfo.total} <span style="font-size: 0.76rem; color: #94a3b8;">(${pct}%)</span></div>
          </button>`;
        }).join('')}
      </div>

      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        ${filterBtns
          .map(
            (b) => `<button type="button" class="hsr-btn-secondary exp-codex-tab" data-tab="${b.id}" style="min-height: 36px; padding: 6px 12px; font-size: 0.8rem; ${
              this.codexFilter === b.id ? 'border-color: #f7d996; background: rgba(229,184,105,0.2);' : ''
            }">${b.label}</button>`
          )
          .join('')}
      </div>

      ${bodyHtml}
    `;

    document.getElementById('btn-astral-codex-close')?.addEventListener('click', () => {
      document.getElementById('modal-astral-codex')?.classList.add('hidden');
      this.resumeIfOpen();
    });
    card.querySelectorAll('.exp-codex-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.codexFilter = (btn as HTMLElement).dataset.tab as typeof this.codexFilter;
        this.renderCodexModal();
      });
    });
    card.querySelectorAll('.exp-codex-planet').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.codexPlanetFilter = (btn as HTMLElement).dataset.planet as typeof this.codexPlanetFilter;
        this.renderCodexModal();
      });
    });
    card.querySelectorAll('.exp-relic-card.is-unlocked').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedCodexRelicId = (btn as HTMLElement).dataset.relicId || null;
        this.renderCodexModal();
      });
    });
  }

  private renderWorkshopModal() {
    const card = document.getElementById('workshop-card');
    if (!card) return;
    const localItems = WORKSHOP_INGREDIENTS.filter((i) => i.side === 'local');
    const globalItems = WORKSHOP_INGREDIENTS.filter((i) => i.side === 'global');

    let activeQuizHtml = '';
    if (this.activeWorkshopRecipe) {
      const r = this.activeWorkshopRecipe;
      const shuffled = shuffleOptionsKeepAnswer(r.options, r.correctIndex);
      activeQuizHtml = `
        <div class="hsr-panel-inner" style="padding: 14px; border-color: #f7d996;">
          <div style="display: flex; gap: 14px; align-items: center; flex-wrap: wrap; margin-bottom: 10px;">
            <div>${renderRelicSvg(getRelicById(r.resultRelicId)?.artKey || r.resultRelicId.replace('glocal_', ''), 'glocal', 76)}</div>
            <div style="flex: 1; min-width: 220px;">
              <div style="font-size: 0.74rem; color: #34d399; font-weight: 700;">HASIL SINTESIS INOVASI</div>
              <div class="font-display" style="font-size: 1.15rem; font-weight: 800; color: #f7d996;">${r.resultName}</div>
              <div style="font-size: 0.86rem; color: #cbd5e1;">${r.tagline}</div>
            </div>
          </div>
          <div style="font-weight: 700; margin-bottom: 8px;">${r.question}</div>
          <div id="workshop-quiz-opts" style="display: flex; flex-direction: column; gap: 8px;">
            ${shuffled.options
              .map(
                (opt, idx) =>
                  `<button type="button" class="exp-choice-btn workshop-q-btn" data-correct="${
                    idx === shuffled.correctIndex ? '1' : '0'
                  }">${opt}</button>`
              )
              .join('')}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
        <div>
          <div style="font-size: 0.74rem; font-weight: 700; color: #f7d996;">LABORATORIUM GLOKALISASI</div>
          <h3 id="workshop-title" class="font-display" style="margin: 2px 0 0; font-size: 1.3rem;">Glocalization Workshop</h3>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="tabular-nums" style="font-weight: 800; color: #38bdf8;">Glocal Crystals: ${this.progress.glocalCrystals}</span>
          <button id="btn-workshop-close" class="icon-btn" type="button" aria-label="Tutup Workshop">✕</button>
        </div>
      </div>

      <p style="margin: 0; font-size: 0.88rem; color: #cbd5e1;">
        Pilih 1 Unsur Budaya Lokal dan 1 Pengaruh Global untuk menghasilkan inovasi bermakna, lalu jelaskan mengapa perpaduan itu termasuk glokalisasi!
      </p>

      <div class="exp-workshop-cols">
        <div>
          <div style="font-size: 0.78rem; font-weight: 700; color: #34d399; margin-bottom: 6px;">1. UNSUR BUDAYA LOKAL</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${localItems
              .map(
                (item) => `<button type="button" class="exp-ing-btn exp-local-pick${
                  this.selectedLocalIng === item.id ? ' is-picked' : ''
                }" data-id="${item.id}">
                  <div style="width: 40px; height: 40px; flex-shrink: 0;">${renderRelicSvg(item.artKey, 'local', 40)}</div>
                  <div>
                    <div style="font-weight: 700; font-size: 0.88rem;">${item.name}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8;">${item.origin}</div>
                  </div>
                </button>`
              )
              .join('')}
          </div>
        </div>
        <div>
          <div style="font-size: 0.78rem; font-weight: 700; color: #38bdf8; margin-bottom: 6px;">2. PENGARUH GLOBAL</div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${globalItems
              .map(
                (item) => `<button type="button" class="exp-ing-btn exp-global-pick${
                  this.selectedGlobalIng === item.id ? ' is-picked' : ''
                }" data-id="${item.id}">
                  <div style="width: 40px; height: 40px; flex-shrink: 0;">${renderRelicSvg(item.artKey, 'global', 40)}</div>
                  <div>
                    <div style="font-weight: 700; font-size: 0.88rem;">${item.name}</div>
                    <div style="font-size: 0.75rem; color: #94a3b8;">${item.origin}</div>
                  </div>
                </button>`
              )
              .join('')}
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;">
        <div style="font-size: 0.82rem; color: #94a3b8;">Inovasi Selesai: <strong class="tabular-nums" style="color: #f7d996;">${this.progress.craftedRecipes.length} / ${WORKSHOP_RECIPES.length}</strong></div>
        <button id="btn-workshop-combine" class="hsr-btn-primary" type="button">Padukan di Laboratorium</button>
      </div>

      ${
        this.workshopFeedback
          ? `<div class="hsr-panel-inner" style="padding: 10px 12px; font-size: 0.88rem; color: #fde68a;">${this.workshopFeedback}</div>`
          : ''
      }
      ${activeQuizHtml}
    `;

    document.getElementById('btn-workshop-close')?.addEventListener('click', () => {
      document.getElementById('modal-workshop')?.classList.add('hidden');
      this.syncHudBars();
      this.renderPlanetTabs();
      this.renderMissionSidebar();
      this.renderMissionClue();
      this.resumeIfOpen();
    });

    card.querySelectorAll('.exp-local-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedLocalIng = (btn as HTMLElement).dataset.id || '';
        this.activeWorkshopRecipe = null;
        this.renderWorkshopModal();
      });
    });

    card.querySelectorAll('.exp-global-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.selectedGlobalIng = (btn as HTMLElement).dataset.id || '';
        this.activeWorkshopRecipe = null;
        this.renderWorkshopModal();
      });
    });

    document.getElementById('btn-workshop-combine')?.addEventListener('click', () => {
      const check = evaluateWorkshopCombination(this.selectedLocalIng, this.selectedGlobalIng);
      this.workshopFeedback = check.feedback;
      this.activeWorkshopRecipe = check.valid ? check.recipe : null;
      this.bridge.playSfx?.(check.valid ? 'skill' : 'wrong');
      this.renderWorkshopModal();
    });

    card.querySelectorAll('.workshop-q-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.activeWorkshopRecipe) return;
        const isCorrect = (btn as HTMLElement).dataset.correct === '1';
        const chosenIndex = isCorrect
          ? this.activeWorkshopRecipe.correctIndex
          : (this.activeWorkshopRecipe.correctIndex + 1) % 3;
        const result = evaluateWorkshopQuiz(this.progress, this.activeWorkshopRecipe, chosenIndex);
        this.progress = result.progress;
        this.persist();
        if (result.isCorrect) {
          if (result.jadeGained > 0) this.bridge.addJades(result.jadeGained);
          this.bridge.playSfx?.('reward');
          this.workshopFeedback = `Benar! +${result.crystalGained} Glocal Crystals & +${result.jadeGained} Stellar Jades. ${result.explanation}`;
          this.activeWorkshopRecipe = null;
        } else {
          this.bridge.playSfx?.('wrong');
          this.workshopFeedback = result.explanation;
        }
        this.syncHudBars();
        this.renderWorkshopModal();
      });
    });
  }

  private renderAccessoriesModal() {
    const card = document.getElementById('explore-acc-card');
    if (!card) return;
    const jades = this.bridge.getJades();
    const spNow = this.progress.exploreSp ?? 100;
    const maxSp = this.progress.maxExploreSp ?? 100;
    const potCount = this.progress.spPotions ?? 0;
    const hintCount = this.progress.hintTokens ?? 0;

    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px;">
        <div>
          <div style="font-size: 0.74rem; font-weight: 700; color: #f7d996;">TOKO ASTRALVERSE · PERBEKALAN &amp; AURA</div>
          <h3 id="acc-title" class="font-display" style="margin: 2px 0 0; font-size: 1.25rem;">Toko Perbekalan &amp; Aksesori Penjelajah</h3>
        </div>
        <button id="btn-acc-close" class="icon-btn" type="button" aria-label="Tutup Toko">✕</button>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 0.86rem; color: #cbd5e1;">
        <span>Saldo Stellar Jades: <strong class="tabular-nums" style="color: #f7d996;">${Math.round(jades)} Jades</strong></span>
        <span class="tabular-nums" style="font-size: 0.8rem; color: #94a3b8;">
          SP ${spNow}/${maxSp} · ⚡ Ramuan: ${potCount} · 🔍 Token: ${hintCount}
        </span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 0.78rem; font-weight: 700; color: #38bdf8;">PERBEKALAN EKSPLORASI</div>
        ${EXPLORATION_SUPPLIES.map((sup) => {
          const afford = jades >= sup.price;
          return `<div class="hsr-panel-inner" style="padding: 11px 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
              <div style="font-weight: 700; color: ${sup.color};">${sup.symbol} ${sup.name}</div>
              <div style="font-size: 0.8rem; color: #cbd5e1;">${sup.description}</div>
            </div>
            <button type="button" class="hsr-btn-primary supply-buy-btn" data-supply-id="${sup.id}" ${
              !afford ? 'disabled' : ''
            } style="min-height: 36px; padding: 5px 12px; font-size: 0.8rem;">
              Beli (${sup.price} Jades)
            </button>
          </div>`;
        }).join('')}
      </div>

      <div style="display: flex; flex-direction: column; gap: 8px;">
        <div style="font-size: 0.78rem; font-weight: 700; color: #f7d996;">AKSESORI &amp; AURA PENJELAJAH</div>
        ${EXPLORER_ACCESSORIES.map((acc) => {
          const owned = this.progress.ownedAccessories.includes(acc.id);
          const equipped = this.progress.equippedAccessory === acc.id;
          const afford = jades >= acc.price;
          return `<div class="hsr-panel-inner" style="padding: 11px 12px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 200px;">
              <div style="font-weight: 700; color: ${acc.color};">${acc.symbol} ${acc.name}</div>
              <div style="font-size: 0.8rem; color: #cbd5e1;">${acc.description}</div>
            </div>
            <button type="button" class="${equipped ? 'hsr-btn-secondary' : 'hsr-btn-primary'} acc-action-btn" data-id="${acc.id}" ${
              equipped || (!owned && !afford) ? 'disabled' : ''
            } style="min-height: 36px; padding: 5px 12px; font-size: 0.8rem;">
              ${equipped ? 'Dipakai ✓' : owned ? 'Pasang' : `Beli (${acc.price} Jades)`}
            </button>
          </div>`;
        }).join('')}
      </div>
    `;

    document.getElementById('btn-acc-close')?.addEventListener('click', () => {
      document.getElementById('modal-explore-accessories')?.classList.add('hidden');
      this.resumeIfOpen();
    });

    card.querySelectorAll('.supply-buy-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sid = (btn as HTMLElement).dataset.supplyId as 'sp_elixir' | 'hint_lens' | 'astra_tonic';
        const res = purchaseExplorationSupply(this.progress, this.bridge.getJades(), sid);
        if (res.ok) {
          if (res.cost > 0) this.bridge.spendJades(res.cost);
          this.progress = res.progress;
          if (res.hpBonus > 0) {
            this.currentPlayerHp = Math.min(100, this.currentPlayerHp + res.hpBonus);
          }
          this.persist();
          this.bridge.playSfx?.('sp_recover');
          this.syncHudBars();
          this.renderAccessoriesModal();
        }
      });
    });

    card.querySelectorAll('.acc-action-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.id || '';
        const res = purchaseExplorerAccessory(this.progress, this.bridge.getJades(), id);
        if (res.ok) {
          if (res.cost > 0) this.bridge.spendJades(res.cost);
          this.progress = res.progress;
          this.persist();
          this.bridge.playSfx?.('reward');
          this.syncHudBars();
          this.renderAccessoriesModal();
        }
      });
    });
  }

  private renderGuardianSelectModal() {
    const card = document.getElementById('guardian-select-card');
    if (!card) return;
    const activeHero = this.bridge.getHeroId();
    const poses: { id: HeroAnimState; label: string }[] = [
      { id: 'idle', label: 'Idle' },
      { id: 'walk', label: 'Berjalan' },
      { id: 'run', label: 'Berlari' },
      { id: 'jump', label: 'Melompat' },
      { id: 'attack', label: 'Serang' },
      { id: 'artifact', label: 'Artefak' },
    ];
    const order: HeroId[] = ['sparxie', 'sparkle', 'sampo', 'nihilux'];

    if (card.dataset.mounted !== '1') {
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
          <div>
            <div style="font-size: 0.74rem; font-weight: 700; color: #f7d996;">KOLEKSI PENJAGA ASTRALVERSE · FULL-BODY RPG</div>
            <h3 id="guardian-select-title" class="font-display" style="margin: 2px 0 0; font-size: 1.32rem;">Pilih Penjaga &amp; Pratinjau Animasi</h3>
          </div>
          <button id="btn-guardian-select-close" class="icon-btn" type="button" aria-label="Tutup Pemilihan Penjaga">✕</button>
        </div>

        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span style="font-size: 0.78rem; color: #94a3b8; font-weight: 700;">Pratinjau Pose:</span>
          ${poses
            .map(
              (p) => `<button type="button" class="hsr-btn-secondary exp-pose-chip" data-pose="${p.id}" style="min-height: 30px; padding: 3px 10px; font-size: 0.76rem;">${p.label}</button>`
            )
            .join('')}
        </div>

        <div class="exp-guardian-grid">
          ${order
            .map((id) => {
              const prof = RPG_CHARACTER_PROFILES[id];
              const power = getGuardianPower(id);
              const selected = id === activeHero;
              return `
              <div class="exp-guardian-card${selected ? ' is-selected' : ''}" data-guardian-card="${id}">
                <div class="exp-fullbody-stage">
                  <img class="exp-stage-portrait-badge" src="${prof.portraitUrl}" alt="Potret ${prof.name}" decoding="async" />
                  <canvas class="exp-fullbody-canvas" data-hero="${id}" width="158" height="205" aria-label="Tampilan Full-Body ${prof.name}"></canvas>
                </div>
                <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 6px;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span class="font-display" style="font-weight: 800; font-size: 1.08rem; color: ${prof.accentColor};">${prof.name}</span>
                      <span style="font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 6px; background: rgba(139, 92, 246, 0.24); border: 1px solid ${prof.accentColor}66; color: ${prof.accentColor};">${prof.roleBadge}</span>
                    </div>
                    <div style="font-size: 0.74rem; color: #cbd5e1; margin-top: 1px;">${prof.title}</div>
                    <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 3px;">Karakter: <strong style="color: #e2e8f0;">${prof.personality}</strong></div>
                    <div style="font-size: 0.74rem; color: #f1f5f9; margin-top: 5px; line-height: 1.38;">
                      <strong style="color: #f7d996;">[F] ${power.skillName}:</strong> ${power.shortDesc}
                    </div>
                    <div style="font-size: 0.72rem; color: #a5f3fc; margin-top: 3px; line-height: 1.35;">
                      <strong>Pasif (${power.passiveName}):</strong> ${power.passiveDesc}
                    </div>
                  </div>
                  <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 4px;">
                    <span style="font-size: 0.7rem; color: #cbd5e1;">Rekan: <strong>${prof.companionName}</strong></span>
                    <button type="button" class="${selected ? 'hsr-btn-primary' : 'hsr-btn-secondary'} exp-pick-guardian-btn" data-hero="${id}" style="min-height: 34px; padding: 5px 12px; font-size: 0.78rem;">
                      ${selected ? 'Aktif ✓' : 'Pilih Penjaga'}
                    </button>
                  </div>
                </div>
              </div>`;
            })
            .join('')}
        </div>
      `;
      card.dataset.mounted = '1';

      document.getElementById('btn-guardian-select-close')?.addEventListener('click', () => this.closeGuardianSelectModal());
      card.querySelectorAll('.exp-pose-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.guardianPreviewPose = (btn as HTMLElement).dataset.pose as HeroAnimState;
          this.bridge.playSfx?.('click');
          this.renderGuardianSelectModal();
        });
      });
      card.querySelectorAll('.exp-pick-guardian-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const hid = (btn as HTMLElement).dataset.hero as HeroId;
          this.bridge.setHeroId?.(hid);
          this.bridge.playSfx?.('select');
          this.syncHudBars();
          this.renderMissionSidebar();
          this.renderGuardianSelectModal();
        });
      });
    }

    card.querySelectorAll('.exp-pose-chip').forEach((el) => {
      const btn = el as HTMLButtonElement;
      const isPose = btn.dataset.pose === this.guardianPreviewPose;
      btn.style.borderColor = isPose ? '#f7d996' : '';
      btn.style.background = isPose ? 'rgba(247,217,150,0.22)' : '';
      btn.style.color = isPose ? '#f7d996' : '';
    });

    card.querySelectorAll('[data-guardian-card]').forEach((el) => {
      const cardEl = el as HTMLElement;
      const isSel = cardEl.dataset.guardianCard === activeHero;
      cardEl.classList.toggle('is-selected', isSel);
    });

    card.querySelectorAll('.exp-pick-guardian-btn').forEach((el) => {
      const btn = el as HTMLButtonElement;
      const isSel = btn.dataset.hero === activeHero;
      btn.className = `${isSel ? 'hsr-btn-primary' : 'hsr-btn-secondary'} exp-pick-guardian-btn`;
      btn.textContent = isSel ? 'Aktif ✓' : 'Pilih Penjaga';
    });

    this.drawGuardianPreviewFrame(performance.now() / 1000);
  }

  private drawGuardianPreviewFrame(timeSec: number) {
    const canvases = document.querySelectorAll('.exp-fullbody-canvas');
    canvases.forEach((el) => {
      const canvas = el as HTMLCanvasElement;
      const heroId = (canvas.dataset.hero || 'sparxie') as HeroId;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Cosmic pedestal ellipse
      const prof = RPG_CHARACTER_PROFILES[heroId];
      ctx.save();
      ctx.fillStyle = `${prof.accentColor}22`;
      ctx.strokeStyle = `${prof.accentColor}88`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(w * 0.44, h - 19, 38, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const roleKind: RoleAnimKind =
        this.guardianPreviewPose === 'artifact'
          ? heroId === 'sparkle'
            ? 'bonus'
            : heroId === 'sparxie'
              ? 'clue'
              : heroId === 'sampo'
                ? 'trick'
                : 'cosmic'
          : null;

      ctx.translate(w * 0.44, h - 21);
      drawAnimeHeroSprite(ctx, {
        heroId,
        animState: this.guardianPreviewPose,
        roleAnim: roleKind,
        facing: 1,
        timeSec,
        walkDist: timeSec * 140,
        vy: this.guardianPreviewPose === 'jump' ? -120 : 0,
        vx: this.guardianPreviewPose === 'run' ? 320 : this.guardianPreviewPose === 'walk' ? 160 : 0,
        animTimer: this.guardianPreviewPose === 'attack' ? (timeSec % 0.6) * 0.6 : 0,
        equippedAccessory: this.progress.equippedAccessory,
        scale: 1.52,
        clueAngle: -0.35,
      });
      ctx.restore();

      // Companion beside hero
      drawCosmicCompanion(ctx, w * 0.77, h - 122, heroId, this.guardianPreviewPose, timeSec, 1.05);
    });
  }

  private startGuardianPreviewLoop() {
    this.stopGuardianPreviewLoop();
    this.guardianPreviewRaf = window.setInterval(() => {
      const modal = document.getElementById('modal-guardian-select');
      if (!modal || modal.classList.contains('hidden')) {
        this.stopGuardianPreviewLoop();
        return;
      }
      this.drawGuardianPreviewFrame(performance.now() / 1000);
    }, 180);
  }

  private stopGuardianPreviewLoop() {
    if (this.guardianPreviewRaf !== null) {
      window.clearInterval(this.guardianPreviewRaf);
      this.guardianPreviewRaf = null;
    }
  }
}
