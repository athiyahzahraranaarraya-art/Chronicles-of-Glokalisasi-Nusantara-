import type { HeroId, PlanetId } from './types';

export type HeroAnimState =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jump'
  | 'attack'
  | 'hurt'
  | 'interact'
  | 'artifact';

export type RoleAnimKind = null | 'bonus' | 'clue' | 'trick' | 'cosmic';

export const ALL_HERO_ANIM_STATES: HeroAnimState[] = [
  'idle',
  'walk',
  'run',
  'jump',
  'attack',
  'hurt',
  'interact',
  'artifact',
];

export interface HeroRenderOptions {
  heroId: HeroId;
  animState: HeroAnimState;
  roleAnim?: RoleAnimKind;
  facing: 1 | -1;
  timeSec: number;
  walkDist: number;
  vy?: number;
  vx?: number;
  animTimer?: number;
  skillTimer?: number;
  landSquash?: number;
  equippedAccessory?: string;
  scale?: number;
  clueAngle?: number | null;
}

interface PoseSolution {
  hipY: number;
  torsoLean: number;
  headTilt: number;
  leftThigh: number;
  leftShin: number;
  rightThigh: number;
  rightShin: number;
  leftArm: number;
  leftForearm: number;
  rightArm: number;
  rightForearm: number;
  capeSwing: number;
  hairSwing: number;
  scaleX: number;
  scaleY: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - (1 - x) * (1 - x) * (1 - x);
}

function easeInOutSine(t: number): number {
  const x = clamp(t, 0, 1);
  return -(Math.cos(Math.PI * x) - 1) / 2;
}

function solveHeroPose(opts: HeroRenderOptions): PoseSolution {
  const {
    heroId,
    animState,
    roleAnim,
    timeSec,
    walkDist,
    vy = 0,
    vx = 0,
    animTimer = 0,
    skillTimer = 0,
    landSquash = 0,
  } = opts;
  const breath = Math.sin(timeSec * 2.5);
  const floatWave = Math.sin(timeSec * 3.3);
  const speedRatio = clamp(Math.abs(vx) / 340, 0, 1.2);
  const airWave = clamp(vy / 520, -1, 1);

  let pose: PoseSolution = {
    hipY: breath * 1.4,
    torsoLean: 0.02 + breath * 0.015,
    headTilt: -0.02 + Math.sin(timeSec * 1.9) * 0.025,
    leftThigh: -0.06,
    leftShin: 0.08,
    rightThigh: 0.07,
    rightShin: 0.05,
    leftArm: 0.22 + breath * 0.04,
    leftForearm: -0.25,
    rightArm: -0.22 - breath * 0.04,
    rightForearm: -0.35,
    capeSwing: floatWave * 4.5,
    hairSwing: floatWave * 3.2,
    scaleX: 1,
    scaleY: 1,
  };

  if (animState === 'walk') {
    const ph = walkDist * 0.14;
    const sw = Math.sin(ph);
    const lift = Math.abs(Math.cos(ph));
    pose.hipY = -lift * 3.2;
    pose.torsoLean = 0.09;
    pose.headTilt = -0.04;
    pose.leftThigh = sw * 0.56;
    pose.leftShin = Math.max(0.05, -sw * 0.48 + 0.16);
    pose.rightThigh = -sw * 0.56;
    pose.rightShin = Math.max(0.05, sw * 0.48 + 0.16);
    pose.leftArm = -sw * 0.52;
    pose.leftForearm = -0.35;
    pose.rightArm = sw * 0.52;
    pose.rightForearm = -0.4;
    pose.capeSwing = -Math.abs(vx) * 0.028 - 4 + Math.sin(ph * 2) * 3;
    pose.hairSwing = -Math.abs(vx) * 0.032 - 3 + Math.cos(ph * 2) * 2.5;
  } else if (animState === 'run') {
    const ph = walkDist * 0.18;
    const sw = Math.sin(ph);
    const lift = Math.abs(Math.cos(ph));
    pose.hipY = -lift * 5.2 - 1;
    pose.torsoLean = 0.24;
    pose.headTilt = -0.14;
    pose.leftThigh = sw * 0.85;
    pose.leftShin = sw < 0 ? 0.82 : 0.15;
    pose.rightThigh = -sw * 0.85;
    pose.rightShin = sw > 0 ? 0.82 : 0.15;
    pose.leftArm = -sw * 0.78 - 0.12;
    pose.leftForearm = -0.75;
    pose.rightArm = sw * 0.78 - 0.12;
    pose.rightForearm = -0.75;
    pose.capeSwing = -14 + Math.sin(timeSec * 12) * 4;
    pose.hairSwing = -16 + Math.cos(timeSec * 12) * 3.5;
  } else if (animState === 'jump') {
    const rising = vy < 0;
    pose.hipY = rising ? -5 : -2;
    pose.torsoLean = rising ? 0.12 : -0.06;
    pose.headTilt = rising ? -0.1 : 0.08;
    pose.leftThigh = rising ? -0.68 : -0.32;
    pose.leftShin = rising ? 0.85 : 0.45;
    pose.rightThigh = rising ? 0.42 : 0.22;
    pose.rightShin = rising ? 0.28 : 0.35;
    pose.leftArm = rising ? -1.15 : -1.45;
    pose.leftForearm = -0.35;
    pose.rightArm = rising ? 0.85 : 1.15;
    pose.rightForearm = -0.45;
    pose.capeSwing = rising ? -10 : -18;
    pose.hairSwing = rising ? -8 : -17;
    pose.scaleX = rising ? 0.94 : 1.04;
    pose.scaleY = rising ? 1.07 : 0.96;
  } else if (animState === 'attack') {
    const p = clamp(1 - animTimer / 0.38, 0, 1);
    // 3-phase anticipation -> strike -> recovery
    let swing = 0;
    let armAngle = -0.6;
    if (p < 0.24) {
      const a = easeInOutSine(p / 0.24);
      swing = -0.35 * a;
      armAngle = -0.7 - a * 1.35;
    } else if (p < 0.66) {
      const s = easeOutCubic((p - 0.24) / 0.42);
      swing = -0.35 + s * 1.4;
      armAngle = -2.05 + s * 2.75;
    } else {
      const r = easeInOutSine((p - 0.66) / 0.34);
      swing = 1.05 * (1 - r);
      armAngle = 0.7 - r * 0.9;
    }
    pose.hipY = -3.4 * Math.max(0, swing) + (p < 0.24 ? 2 : 0);
    pose.torsoLean = 0.28 * swing + (heroId === 'nihilux' ? 0.02 : 0.08);
    pose.headTilt = -0.1 * swing;
    pose.leftThigh = -0.42 - 0.14 * Math.max(0, swing);
    pose.leftShin = 0.38;
    pose.rightThigh = 0.48 + 0.16 * Math.max(0, swing);
    pose.rightShin = 0.22;
    pose.rightArm = armAngle;
    pose.rightForearm = heroId === 'sparkle' ? -0.32 : -0.16;
    pose.leftArm = 0.68;
    pose.leftForearm = -0.52;
    pose.capeSwing = -17 * Math.max(0, swing) - 6 - speedRatio * 5;
    pose.hairSwing = -15 * Math.max(0, swing) - 5 - speedRatio * 5;
  } else if (animState === 'hurt') {
    const recoil = Math.sin(timeSec * 24) * 0.08;
    pose.hipY = -3;
    pose.torsoLean = -0.26 + recoil;
    pose.headTilt = 0.22;
    pose.leftThigh = -0.32;
    pose.leftShin = 0.42;
    pose.rightThigh = 0.22;
    pose.rightShin = 0.35;
    pose.leftArm = -0.95;
    pose.leftForearm = -0.85;
    pose.rightArm = -0.55;
    pose.rightForearm = -0.95;
    pose.capeSwing = 10;
    pose.hairSwing = 8;
  } else if (animState === 'interact') {
    pose.hipY = -1.5;
    pose.torsoLean = 0.16;
    pose.headTilt = -0.08;
    pose.rightArm = -1.05 + Math.sin(timeSec * 7) * 0.12;
    pose.rightForearm = -0.28;
    pose.leftArm = 0.28;
    pose.leftForearm = -0.45;
    pose.capeSwing = -5;
  } else if (animState === 'artifact') {
    pose.hipY = -6 + Math.sin(timeSec * 5) * 2.5;
    pose.torsoLean = -0.06;
    pose.headTilt = -0.14;
    pose.leftThigh = -0.16;
    pose.rightThigh = 0.2;
    pose.rightArm = -2.42;
    pose.rightForearm = -0.15;
    pose.leftArm = 1.95;
    pose.leftForearm = -0.25;
    pose.capeSwing = -12 + Math.sin(timeSec * 8) * 5;
    pose.hairSwing = -10 + Math.cos(timeSec * 8) * 4;
  }

  // Secondary cloth & air-drag inertia
  pose.capeSwing += -speedRatio * 4.5 + airWave * 6;
  pose.hairSwing += -speedRatio * 3.8 + airWave * 5;

  // Landing squash-and-stretch smoothing
  if (landSquash > 0.01) {
    const sq = easeOutCubic(landSquash);
    pose.scaleX *= 1 + 0.16 * sq;
    pose.scaleY *= 1 - 0.14 * sq;
    pose.hipY += 3.5 * sq;
  }

  // Hero signature skill-cast gesture when freshly triggered
  if (skillTimer > 0) {
    const sp = easeOutCubic(clamp(skillTimer / 0.55, 0, 1));
    if (heroId === 'nihilux') {
      pose.hipY -= 4 * sp;
      pose.rightArm = -1.55;
      pose.leftArm = 1.25;
    } else if (heroId === 'sparkle') {
      pose.headTilt = -0.12 * sp;
      pose.rightArm = -1.95;
      pose.leftArm = 1.45;
    } else if (heroId === 'sampo') {
      pose.torsoLean += 0.15 * sp;
      pose.rightArm = -1.42;
      pose.leftArm = -0.9;
    } else {
      pose.hipY -= 5 * sp;
      pose.rightArm = -2.15;
      pose.leftArm = 1.7;
    }
  }

  // Layer role-signature flourishes when active
  if (roleAnim === 'bonus') {
    pose.headTilt = -0.1 + Math.sin(timeSec * 7) * 0.08;
    pose.rightArm = Math.min(pose.rightArm, -1.65);
    pose.leftArm = 1.35;
  } else if (roleAnim === 'clue') {
    pose.torsoLean += 0.08;
    pose.rightArm = -1.48;
    pose.rightForearm = -0.05;
  } else if (roleAnim === 'trick') {
    pose.headTilt = 0.08;
    pose.rightArm = -1.25;
    pose.rightForearm = -0.4;
  } else if (roleAnim === 'cosmic') {
    pose.hipY -= 4 + Math.sin(timeSec * 4) * 2.5;
    pose.leftArm = 1.1;
    pose.rightArm = -1.3;
  }

  return pose;
}

interface HeroThemePalette {
  hairMain: string;
  hairShadow: string;
  hairInner?: string;
  hairHighlight: string;
  eyeTop: string;
  eyeBottom: string;
  coatMain: string;
  coatDark: string;
  coatAccent: string;
  trimGold: string;
  cosmicViolet: string;
  bootColor: string;
  stockingColor: string;
  skin: string;
  skinShadow: string;
}

const HERO_PALETTES: Record<HeroId, HeroThemePalette> = {
  sparxie: {
    hairMain: '#f8fafc',
    hairShadow: '#cbd5e1',
    hairInner: '#e9d5ff',
    hairHighlight: '#ffffff',
    eyeTop: '#db2777',
    eyeBottom: '#fda4af',
    coatMain: '#be123c',
    coatDark: '#161b3d',
    coatAccent: '#f8fafc',
    trimGold: '#f7d996',
    cosmicViolet: '#8b5cf6',
    bootColor: '#171c3a',
    stockingColor: '#f1f5f9',
    skin: '#fff1e8',
    skinShadow: '#f3cfc1',
  },
  sparkle: {
    hairMain: '#3d2428',
    hairShadow: '#231317',
    hairInner: '#be123c',
    hairHighlight: '#fda4af',
    eyeTop: '#be185d',
    eyeBottom: '#f472b6',
    coatMain: '#9f1239',
    coatDark: '#12132e',
    coatAccent: '#e11d48',
    trimGold: '#f7d996',
    cosmicViolet: '#7e22ce',
    bootColor: '#181432',
    stockingColor: '#1e1b4b',
    skin: '#fff1e8',
    skinShadow: '#f2ccc0',
  },
  sampo: {
    hairMain: '#2563eb',
    hairShadow: '#1e3a8a',
    hairInner: '#e2e8f0',
    hairHighlight: '#93c5fd',
    eyeTop: '#059669',
    eyeBottom: '#6ee7b7',
    coatMain: '#9f1239',
    coatDark: '#1e293b',
    coatAccent: '#64748b',
    trimGold: '#f7d996',
    cosmicViolet: '#6366f1',
    bootColor: '#171f36',
    stockingColor: '#1e293b',
    skin: '#ffefe6',
    skinShadow: '#ebc5b5',
  },
  nihilux: {
    hairMain: '#f1f5f9',
    hairShadow: '#cbd5e1',
    hairInner: '#86198f',
    hairHighlight: '#ffffff',
    eyeTop: '#7e22ce',
    eyeBottom: '#e879f9',
    coatMain: '#e2e8f0',
    coatDark: '#17153b',
    coatAccent: '#4c1d95',
    trimGold: '#f7d996',
    cosmicViolet: '#a855f7',
    bootColor: '#13112c',
    stockingColor: '#1f1947',
    skin: '#fff2ea',
    skinShadow: '#efd0c4',
  },
};

function drawTaperedLimb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r1: number,
  r2: number,
  fill: string,
  outline = '#0f172a'
) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  ctx.beginPath();
  ctx.moveTo(x1 + nx * r1, y1 + ny * r1);
  ctx.lineTo(x2 + nx * r2, y2 + ny * r2);
  ctx.arc(x2, y2, r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(x1 - nx * r1, y1 - ny * r1);
  ctx.arc(x1, y1, r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

function drawRpgLeg(
  ctx: CanvasRenderingContext2D,
  hipX: number,
  hipY: number,
  thighAngle: number,
  shinBend: number,
  pal: HeroThemePalette,
  isSampo: boolean
) {
  const thighLen = 13.5;
  const shinLen = 15;
  const kneeX = hipX + Math.sin(thighAngle) * thighLen;
  const kneeY = hipY + Math.cos(thighAngle) * thighLen;
  const shinAngle = thighAngle - shinBend;
  const ankleX = kneeX + Math.sin(shinAngle) * shinLen;
  const ankleY = kneeY + Math.cos(shinAngle) * shinLen;

  // Thigh
  drawTaperedLimb(ctx, hipX, hipY, kneeX, kneeY, 4.4, 3.6, isSampo ? '#1e293b' : pal.stockingColor);

  // Sculpted RPG Boot
  drawTaperedLimb(ctx, kneeX, kneeY, ankleX, ankleY, 3.8, 3.2, pal.bootColor);
  // Gold boot cuff trim
  ctx.save();
  ctx.translate(kneeX, kneeY);
  ctx.rotate(-shinAngle);
  ctx.fillStyle = pal.trimGold;
  ctx.beginPath();
  ctx.roundRect(-4.3, -1.5, 8.6, 3.2, 1.5);
  ctx.fill();
  ctx.restore();

  // Boot foot/sole
  ctx.save();
  ctx.translate(ankleX, ankleY);
  ctx.rotate(-shinAngle * 0.5);
  ctx.fillStyle = pal.bootColor;
  ctx.strokeStyle = '#090d1e';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-3.4, -1.5);
  ctx.lineTo(6.2, 0.5);
  ctx.quadraticCurveTo(7.4, 3.4, 4.4, 3.8);
  ctx.lineTo(-3.8, 3.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Gold toe/buckle highlight
  ctx.fillStyle = pal.trimGold;
  ctx.fillRect(0.2, 0.6, 2.4, 1.2);
  ctx.restore();
}

function drawAnimeEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  pal: HeroThemePalette,
  heroId: HeroId,
  mode: 'open' | 'wink' | 'happy' | 'hurt' | 'smirk' | 'fierce'
) {
  ctx.save();
  if (mode === 'wink' || mode === 'happy') {
    ctx.strokeStyle = '#1e1026';
    ctx.lineWidth = 2.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy + 0.5);
    ctx.quadraticCurveTo(cx, cy - ry * 1.15, cx + rx, cy + 0.5);
    ctx.stroke();
    ctx.restore();
    return;
  }
  if (mode === 'hurt') {
    ctx.strokeStyle = '#1e1026';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - rx * 0.9, cy - ry * 0.7);
    ctx.lineTo(cx + rx * 0.4, cy);
    ctx.lineTo(cx - rx * 0.9, cy + ry * 0.7);
    ctx.stroke();
    ctx.restore();
    return;
  }

  const eyeHeight = mode === 'smirk' || mode === 'fierce' ? ry * 0.82 : ry;
  // Sclera
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, eyeHeight, 0, 0, Math.PI * 2);
  ctx.fill();

  // Multi-stop anime iris
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.94, eyeHeight * 0.94, 0, 0, Math.PI * 2);
  ctx.clip();

  const grad = ctx.createLinearGradient(cx, cy - eyeHeight, cx, cy + eyeHeight);
  grad.addColorStop(0, pal.eyeTop);
  grad.addColorStop(1, pal.eyeBottom);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(cx + 0.3, cy + 0.2, rx * 0.74, eyeHeight * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();

  // Deep pupil & star/petal sparkle
  ctx.fillStyle = '#1a0a2e';
  ctx.beginPath();
  ctx.ellipse(cx + 0.3, cy + 0.3, rx * 0.36, eyeHeight * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();

  // Signature eye pattern (star for Nihilux/Sparxie, petal glow for Sparkle)
  if (heroId === 'nihilux' || heroId === 'sparxie') {
    ctx.fillStyle = '#fdf4ff';
    ctx.beginPath();
    ctx.moveTo(cx + 0.3, cy - 1.7);
    ctx.lineTo(cx + 1.4, cy + 0.3);
    ctx.lineTo(cx + 0.3, cy + 2.2);
    ctx.lineTo(cx - 0.8, cy + 0.3);
    ctx.closePath();
    ctx.fill();
  }

  // Crisp anime specular highlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - rx * 0.28, cy - eyeHeight * 0.34, 1.35, 0, Math.PI * 2);
  ctx.arc(cx + rx * 0.34, cy + eyeHeight * 0.34, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Upper sculpted lash arc
  ctx.strokeStyle = '#1a0f24';
  ctx.lineWidth = 2.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - rx * 1.1, cy + 0.3);
  ctx.quadraticCurveTo(cx, cy - eyeHeight * 1.25, cx + rx * 1.15, cy - 0.4);
  ctx.stroke();

  // Lower subtle lash
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx - rx * 0.65, cy + eyeHeight * 0.95);
  ctx.quadraticCurveTo(cx, cy + eyeHeight * 1.1, cx + rx * 0.65, cy + eyeHeight * 0.92);
  ctx.stroke();

  ctx.restore();
}

function drawSparkleFoxMask(ctx: CanvasRenderingContext2D, x: number, y: number, tilt: number, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(scale, scale);

  // Outer crimson fox mask silhouette
  const grad = ctx.createLinearGradient(-10, -10, 10, 10);
  grad.addColorStop(0, '#be123c');
  grad.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = grad;
  ctx.strokeStyle = '#1c0d14';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-8, -3);
  ctx.lineTo(-9, -12);
  ctx.lineTo(-2, -7);
  ctx.lineTo(2, -7);
  ctx.lineTo(9, -12);
  ctx.lineTo(8, -3);
  ctx.quadraticCurveTo(9, 4, 0, 8);
  ctx.quadraticCurveTo(-9, 4, -8, -3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gold filigree forehead & eye slits
  ctx.strokeStyle = '#f7d996';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-4, -5);
  ctx.lineTo(0, -2);
  ctx.lineTo(4, -5);
  ctx.moveTo(-5, -1);
  ctx.quadraticCurveTo(-3, 1, -1.5, -0.5);
  ctx.moveTo(5, -1);
  ctx.quadraticCurveTo(3, 1, 1.5, -0.5);
  ctx.stroke();

  ctx.restore();
}

export function drawAnimeHeroSprite(ctx: CanvasRenderingContext2D, opts: HeroRenderOptions) {
  const {
    heroId,
    animState,
    roleAnim = null,
    facing,
    timeSec,
    equippedAccessory = 'none',
    scale = 1,
    clueAngle = null,
  } = opts;

  const pal = HERO_PALETTES[heroId] || HERO_PALETTES.sparxie;
  const pose = solveHeroPose(opts);
  const hipBaseY = -30 + pose.hipY;

  ctx.save();
  ctx.scale(scale, scale);

  // Artifact glowing pillar aura behind character
  if (animState === 'artifact') {
    const pillarGrad = ctx.createLinearGradient(0, -140, 0, 6);
    pillarGrad.addColorStop(0, 'rgba(247, 217, 150, 0)');
    pillarGrad.addColorStop(0.45, 'rgba(192, 132, 252, 0.25)');
    pillarGrad.addColorStop(1, 'rgba(247, 217, 150, 0.42)');
    ctx.fillStyle = pillarGrad;
    ctx.fillRect(-26, -135, 52, 140);
  }

  // Nihilux cosmic nebula rings behind character
  if (heroId === 'nihilux' && (roleAnim === 'cosmic' || animState === 'attack' || animState === 'artifact')) {
    ctx.save();
    ctx.translate(0, hipBaseY - 18);
    ctx.rotate(timeSec * 0.9);
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.68)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 16, 0.35, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(1.4);
    ctx.strokeStyle = 'rgba(247, 217, 150, 0.55)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(0, 0, 38, 13, -0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Ground shadow
  ctx.fillStyle = animState === 'jump' ? 'rgba(4, 7, 18, 0.28)' : 'rgba(4, 7, 18, 0.48)';
  ctx.beginPath();
  ctx.ellipse(0, 1, 17, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hurt crimson ring flash
  if (animState === 'hurt') {
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.78)';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, hipBaseY - 12, 30, 38, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.save();
  ctx.scale(facing * pose.scaleX, pose.scaleY);

  // Accessory: Selendang Cahaya Nusantara flowing behind
  if (equippedAccessory === 'selendang_nusantara') {
    const wave = Math.sin(timeSec * 6.5) * 7;
    ctx.strokeStyle = 'rgba(247, 217, 150, 0.85)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-6, hipBaseY - 18);
    ctx.bezierCurveTo(-22, hipBaseY - 12 + wave, -34, hipBaseY - 4 - wave, -44, hipBaseY + 6 + wave * 0.6);
    ctx.stroke();
  }

  // 1. Back Coattails / Cloak Layer
  ctx.save();
  ctx.translate(0, hipBaseY);
  ctx.rotate(pose.torsoLean * 0.65);
  const sw = pose.capeSwing;
  const coatGrad = ctx.createLinearGradient(0, -24, sw - 12, 22);
  coatGrad.addColorStop(0, pal.coatDark);
  coatGrad.addColorStop(1, pal.coatMain);
  ctx.fillStyle = coatGrad;
  ctx.strokeStyle = pal.trimGold;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-9, -20);
  ctx.bezierCurveTo(-18 + sw * 0.4, -6, -24 + sw, 8, -19 + sw * 1.1, 21);
  ctx.lineTo(-4 + sw * 0.4, 15);
  ctx.quadraticCurveTo(4, 19, 10 + sw * 0.2, 16);
  ctx.lineTo(8, -18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 2. Back Hair Layer (twin-tails or long flowing cosmic locks)
  ctx.save();
  ctx.translate(0, hipBaseY - 26);
  ctx.rotate(pose.torsoLean + pose.headTilt);
  const hs = pose.hairSwing;
  if (heroId === 'sparxie' || heroId === 'sparkle') {
    // Left/back twin-tail
    const tailGrad = ctx.createLinearGradient(-12, -16, -22 + hs, 24);
    tailGrad.addColorStop(0, pal.hairMain);
    tailGrad.addColorStop(1, heroId === 'sparkle' ? pal.hairInner! : pal.hairShadow);
    ctx.fillStyle = tailGrad;
    ctx.strokeStyle = '#181024';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-9, -15);
    ctx.bezierCurveTo(-26 + hs * 0.4, -10, -28 + hs, 10, -20 + hs * 1.1, 25);
    ctx.quadraticCurveTo(-11 + hs * 0.6, 17, -11, -3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (heroId === 'nihilux') {
    // Long flowing silver-white outer + magenta-violet inner hair
    ctx.fillStyle = pal.hairInner!;
    ctx.beginPath();
    ctx.moveTo(-12, -14);
    ctx.bezierCurveTo(-22 + hs * 0.5, 4, -22 + hs, 24, -13 + hs, 34);
    ctx.lineTo(9 + hs * 0.4, 30);
    ctx.bezierCurveTo(14, 14, 13, -4, 10, -14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = pal.hairMain;
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-13, -15);
    ctx.bezierCurveTo(-23 + hs * 0.6, 2, -21 + hs * 1.1, 20, -15 + hs, 31);
    ctx.quadraticCurveTo(-6 + hs * 0.5, 22, -6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (heroId === 'sampo') {
    // Signature silver-white nape strands behind cobalt hair
    ctx.fillStyle = pal.hairInner!;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-9, -4);
    ctx.lineTo(-16 + hs * 0.6, 8);
    ctx.lineTo(-10 + hs * 0.4, 5);
    ctx.lineTo(-12 + hs * 0.5, 11);
    ctx.lineTo(-3, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // 3. Back Arm
  ctx.save();
  ctx.translate(0, hipBaseY);
  ctx.rotate(pose.torsoLean);
  const bShX = -8;
  const bShY = -20;
  const bElX = bShX + Math.sin(pose.leftArm) * 11;
  const bElY = bShY + Math.cos(pose.leftArm) * 11;
  const bHaX = bElX + Math.sin(pose.leftArm + pose.leftForearm) * 10;
  const bHaY = bElY + Math.cos(pose.leftArm + pose.leftForearm) * 10;
  drawTaperedLimb(ctx, bShX, bShY, bElX, bElY, 3.6, 3.0, pal.coatDark);
  drawTaperedLimb(ctx, bElX, bElY, bHaX, bHaY, 3.0, 2.4, pal.coatMain);
  ctx.fillStyle = '#18142c';
  ctx.beginPath();
  ctx.arc(bHaX, bHaY, 2.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 4. Articulated Legs (back leg -> front leg)
  drawRpgLeg(ctx, -4, hipBaseY + 1, pose.leftThigh, pose.leftShin, pal, heroId === 'sampo');
  drawRpgLeg(ctx, 4.5, hipBaseY + 1, pose.rightThigh, pose.rightShin, pal, heroId === 'sampo');

  // 5. Tailored RPG Torso / Dress / Coat & Waist Belts
  ctx.save();
  ctx.translate(0, hipBaseY);
  ctx.rotate(pose.torsoLean);

  // Skirt / Coat Hem flared forward
  ctx.fillStyle = heroId === 'sampo' ? pal.coatDark : pal.coatMain;
  ctx.strokeStyle = pal.trimGold;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-9, -4);
  ctx.lineTo(-14, 12);
  ctx.quadraticCurveTo(0, 15, 14, 10);
  ctx.lineTo(9, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tailored Upper Torso / Bodice
  const torsoGrad = ctx.createLinearGradient(-10, -24, 10, 0);
  torsoGrad.addColorStop(0, pal.coatMain);
  torsoGrad.addColorStop(1, pal.coatDark);
  ctx.fillStyle = torsoGrad;
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-9.5, -23);
  ctx.quadraticCurveTo(-6, -11, -7.5, -2);
  ctx.lineTo(7.5, -2);
  ctx.quadraticCurveTo(6.5, -11, 9.5, -23);
  ctx.quadraticCurveTo(0, -26, -9.5, -23);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Gold filigree lapel / vest trim
  ctx.strokeStyle = pal.trimGold;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-6, -23);
  ctx.lineTo(0, -11);
  ctx.lineTo(6, -23);
  ctx.stroke();

  // Character-specific torso & waist emblems
  if (heroId === 'sparxie') {
    // Ruffled white lapel + black neck bow + monochrome bunny waist charm
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(-7, -23);
    ctx.lineTo(0, -14);
    ctx.lineTo(7, -23);
    ctx.lineTo(3.5, -23.5);
    ctx.lineTo(0, -17);
    ctx.lineTo(-3.5, -23.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-3.2, -24.5, 6.4, 3);
    // Tiny monochrome bunny charm at waist
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(6.5, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(5.5, 0, 1.8, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
  } else if (heroId === 'sparkle') {
    // Ruby choker + cosmic diamond bodice crest
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-4.5, -26, 9, 2.6);
    ctx.fillStyle = '#fb7185';
    ctx.beginPath();
    ctx.arc(0, -24.7, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.trimGold;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(3.5, -13);
    ctx.lineTo(0, -9);
    ctx.lineTo(-3.5, -13);
    ctx.closePath();
    ctx.fill();
  } else if (heroId === 'sampo') {
    // Crossed leather harness belts + silver shoulder armor pauldron
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-8, -22);
    ctx.lineTo(7, -5);
    ctx.moveTo(8, -22);
    ctx.lineTo(-7, -5);
    ctx.stroke();
    ctx.fillStyle = pal.trimGold;
    ctx.fillRect(-2, -14.5, 4, 3);
    // Ornate silver-violet pauldron
    ctx.fillStyle = '#94a3b8';
    ctx.strokeStyle = '#1e1b4b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(9, -21, 5.8, 3.8, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (heroId === 'nihilux') {
    // Dark navy cosmic vest + glowing violet galaxy bow-tie
    ctx.fillStyle = '#17153b';
    ctx.beginPath();
    ctx.moveTo(-4.5, -23);
    ctx.lineTo(-3.5, -3);
    ctx.lineTo(3.5, -3);
    ctx.lineTo(4.5, -23);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a855f7';
    ctx.strokeStyle = '#f7d996';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -22.5);
    ctx.lineTo(-5, -25);
    ctx.lineTo(-4.5, -20);
    ctx.closePath();
    ctx.moveTo(0, -22.5);
    ctx.lineTo(5, -25);
    ctx.lineTo(4.5, -20);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Waist cosmic sash
  ctx.fillStyle = pal.cosmicViolet;
  ctx.fillRect(-8, -4.5, 16, 3);
  ctx.fillStyle = pal.trimGold;
  ctx.beginPath();
  ctx.moveTo(0, -5.5);
  ctx.lineTo(2.8, -3);
  ctx.lineTo(0, -0.5);
  ctx.lineTo(-2.8, -3);
  ctx.closePath();
  ctx.fill();

  ctx.restore(); // end torso

  // 6. Neck + Sculpted Anime Head & Expressive Face + Front Hair + Headgear
  ctx.save();
  ctx.translate(0, hipBaseY - 24);
  ctx.rotate(pose.torsoLean + pose.headTilt);

  // Neck + chin shadow
  ctx.fillStyle = pal.skinShadow;
  ctx.fillRect(-3, -4, 6, 6);

  // Sculpted Anime Face Contour
  ctx.save();
  ctx.translate(0, -15);
  ctx.fillStyle = pal.skin;
  ctx.strokeStyle = '#281628';
  ctx.lineWidth = 1.45;
  ctx.beginPath();
  ctx.moveTo(-12.5, -4);
  ctx.bezierCurveTo(-13, 5, -9, 12.2, 0, 14);
  ctx.bezierCurveTo(9, 12.2, 13, 5, 12.5, -4);
  ctx.bezierCurveTo(12.2, -14, -12.2, -14, -12.5, -4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Subtle cheek blush
  ctx.fillStyle = 'rgba(251, 113, 133, 0.28)';
  ctx.beginPath();
  ctx.ellipse(-6.5, 4.5, 3, 1.5, 0, 0, Math.PI * 2);
  ctx.ellipse(7.5, 4.5, 3, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Sparxie tiny red heart cheek mark
  if (heroId === 'sparxie') {
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(-6.6, 5.2, 1.1, 0, Math.PI * 2);
    ctx.arc(-5.2, 5.2, 1.1, 0, Math.PI * 2);
    ctx.lineTo(-5.9, 7.1);
    ctx.closePath();
    ctx.fill();
  } else if (heroId === 'sparkle') {
    // Tiny dramatic tear/beauty drop under right eye
    ctx.fillStyle = '#e11d48';
    ctx.beginPath();
    ctx.arc(6.8, 5.4, 1.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // Expressive Eyes & Mouth
  const blink = Math.sin(timeSec * 1.45) > 0.965 && animState === 'idle';
  let leftEyeMode: 'open' | 'wink' | 'happy' | 'hurt' | 'smirk' | 'fierce' = 'open';
  let rightEyeMode: 'open' | 'wink' | 'happy' | 'hurt' | 'smirk' | 'fierce' = 'open';

  if (animState === 'hurt') {
    leftEyeMode = 'hurt';
    rightEyeMode = 'hurt';
  } else if (blink) {
    leftEyeMode = 'wink';
    rightEyeMode = 'wink';
  } else if (animState === 'artifact' || roleAnim === 'bonus') {
    leftEyeMode = heroId === 'sparkle' ? 'smirk' : 'happy';
    rightEyeMode = heroId === 'sparkle' ? 'wink' : 'happy';
  } else if (animState === 'attack') {
    leftEyeMode = 'fierce';
    rightEyeMode = 'fierce';
  } else if (heroId === 'sparxie' && (roleAnim === 'clue' || animState === 'interact')) {
    leftEyeMode = 'wink';
  } else if (heroId === 'sampo' && (roleAnim === 'trick' || animState === 'interact')) {
    rightEyeMode = 'wink';
    leftEyeMode = 'smirk';
  } else if (heroId === 'sparkle') {
    leftEyeMode = 'smirk';
    rightEyeMode = 'smirk';
  }

  drawAnimeEye(ctx, -4.6, 0.8, 3.6, 4.1, pal, heroId, leftEyeMode);
  drawAnimeEye(ctx, 5.6, 0.8, 3.8, 4.1, pal, heroId, rightEyeMode);

  // Nihilux sleek rectangular silver-framed glasses
  if (heroId === 'nihilux') {
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.25;
    ctx.strokeRect(-8.8, -1.8, 8.0, 5.2);
    ctx.strokeRect(1.6, -1.8, 8.0, 5.2);
    ctx.beginPath();
    ctx.moveTo(-0.8, 0.4);
    ctx.lineTo(1.6, 0.4);
    ctx.stroke();
  }

  // Expressive Mouth
  ctx.strokeStyle = '#3b1d28';
  ctx.lineWidth = 1.35;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (animState === 'hurt') {
    ctx.ellipse(0.6, 8.5, 2.2, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#be123c';
    ctx.fill();
  } else if (animState === 'artifact' || (heroId === 'sparxie' && animState !== 'attack')) {
    // Joyful energetic open smile
    ctx.fillStyle = '#e11d48';
    ctx.moveTo(-2.4, 7.2);
    ctx.quadraticCurveTo(0.8, 11.4, 4.2, 7.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (heroId === 'sampo') {
    // Sly confident smirk
    ctx.moveTo(-2, 8.2);
    ctx.quadraticCurveTo(1.5, 9.8, 4.8, 6.8);
    ctx.stroke();
  } else if (heroId === 'sparkle') {
    // Theatrical mysterious smirk
    ctx.moveTo(-2, 7.8);
    ctx.quadraticCurveTo(1.2, 9.4, 3.8, 7.3);
    ctx.stroke();
  } else {
    // Calm serene/determined smile
    ctx.moveTo(-1.8, 8.0);
    ctx.quadraticCurveTo(0.8, 9.0, 3.2, 7.8);
    ctx.stroke();
  }

  // Front Hair Crown + Bangs + Side Locks
  const hairGrad = ctx.createLinearGradient(0, -17, 0, 6);
  hairGrad.addColorStop(0, pal.hairMain);
  hairGrad.addColorStop(1, pal.hairShadow);
  ctx.fillStyle = hairGrad;
  ctx.strokeStyle = '#181024';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-13.8, 3);
  ctx.bezierCurveTo(-15, -13, -7, -17.5, 0.5, -17);
  ctx.bezierCurveTo(9, -17.5, 15, -11, 14, 3);
  // Jagged cel-shaded bangs sweeping across forehead
  ctx.lineTo(10.5, 9);
  ctx.lineTo(9.5, -2.5);
  ctx.lineTo(6.2, 2.5);
  ctx.lineTo(3.6, -4.2);
  ctx.lineTo(0.5, 2.2);
  ctx.lineTo(-2.5, -4.5);
  ctx.lineTo(-5.8, 2.4);
  ctx.lineTo(-9.5, -2.2);
  ctx.lineTo(-11.2, 9.2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Anime hair gloss arc
  ctx.strokeStyle = pal.hairHighlight;
  ctx.globalAlpha = 0.65;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-7.5, -8.5);
  ctx.quadraticCurveTo(0, -11, 7.5, -8);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Front twin-tail (for Sparxie / Sparkle)
  if (heroId === 'sparxie' || heroId === 'sparkle') {
    const hs2 = pose.hairSwing;
    ctx.fillStyle = heroId === 'sparkle' ? pal.hairInner! : pal.hairMain;
    ctx.strokeStyle = '#181024';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(10, -10);
    ctx.bezierCurveTo(22 + hs2 * 0.2, -6, 22 + hs2 * 0.6, 12, 14 + hs2 * 0.8, 25);
    ctx.quadraticCurveTo(9 + hs2 * 0.4, 15, 9, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Hair ribbon tie
    ctx.fillStyle = heroId === 'sparkle' ? '#f7d996' : '#e11d48';
    ctx.fillRect(8.5, -11.5, 4, 3);
  }

  // Headgear per hero + Accessory crown
  if (heroId === 'sparxie') {
    // Tilted miniature black top hat + pink-white bunny ears + dangling gold spade
    ctx.save();
    ctx.translate(-6, -15.5);
    ctx.rotate(-0.34);
    // Bunny ears
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#181024';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(-2, -13, 2.6, 8, -0.15, 0, Math.PI * 2);
    ctx.ellipse(3, -12, 2.5, 7.5, 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.ellipse(-2, -13, 1.1, 4.8, -0.15, 0, Math.PI * 2);
    ctx.ellipse(3, -12, 1.1, 4.5, 0.25, 0, Math.PI * 2);
    ctx.fill();
    // Top hat crown & brim
    ctx.fillStyle = '#17172b';
    ctx.strokeStyle = '#090910';
    ctx.beginPath();
    ctx.roundRect(-6.5, -8.5, 13, 9, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#be123c';
    ctx.fillRect(-6.5, -2.5, 13, 2);
    ctx.beginPath();
    ctx.ellipse(0, 0.2, 10, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#17172b';
    ctx.fill();
    ctx.stroke();
    // Gold pin & dangling spade
    ctx.fillStyle = '#f7d996';
    ctx.beginPath();
    ctx.arc(0, -2, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f7d996';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-7, 1);
    ctx.lineTo(-8, 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-8, 8.5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  } else if (heroId === 'sparkle') {
    // Crimson-and-gold Kitsune Fox Mask tilted on upper side of head
    drawSparkleFoxMask(ctx, -8.5, -13.5, -0.35, 0.88);
  } else if (heroId === 'nihilux') {
    // Sleek cosmic navy military beret with silver clasps + cat-ear folds + ribbon
    ctx.save();
    ctx.translate(0, -14.5);
    ctx.rotate(-0.12);
    ctx.fillStyle = '#1b183a';
    ctx.strokeStyle = '#090915';
    ctx.lineWidth = 1.3;
    // Cat-ear corner folds on beret
    ctx.beginPath();
    ctx.moveTo(-12, 1);
    ctx.lineTo(-10, -10);
    ctx.lineTo(-4, -5);
    ctx.quadraticCurveTo(0, -9, 4, -5);
    ctx.lineTo(10, -10);
    ctx.lineTo(12, 1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Visor brim + silver double clasp
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(1, 1.5, 13.5, 3.2, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(-3, -2.5, 2, 3.5);
    ctx.fillRect(0.5, -2.5, 2, 3.5);
    // Trailing cosmic ribbon
    ctx.fillStyle = '#7e22ce';
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(-19 + pose.hairSwing * 0.4, 6);
    ctx.lineTo(-16 + pose.hairSwing * 0.4, 9);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Optional shop crown accessory
  if (equippedAccessory === 'mahkota_majapahit') {
    ctx.fillStyle = '#f7d996';
    ctx.strokeStyle = '#7e22ce';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-8, -15);
    ctx.lineTo(-5, -24);
    ctx.lineTo(0, -18);
    ctx.lineTo(5, -24);
    ctx.lineTo(8, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore(); // end face
  ctx.restore(); // end head

  // 7. Front Arm + Gloved Hand + Signature RPG Prop
  ctx.save();
  ctx.translate(0, hipBaseY);
  ctx.rotate(pose.torsoLean);
  const fShX = 8;
  const fShY = -20;
  const fElX = fShX + Math.sin(pose.rightArm) * 11.5;
  const fElY = fShY + Math.cos(pose.rightArm) * 11.5;
  const fHaX = fElX + Math.sin(pose.rightArm + pose.rightForearm) * 10.5;
  const fHaY = fElY + Math.cos(pose.rightArm + pose.rightForearm) * 10.5;
  drawTaperedLimb(ctx, fShX, fShY, fElX, fElY, 3.8, 3.2, pal.coatMain);
  drawTaperedLimb(ctx, fElX, fElY, fHaX, fHaY, 3.2, 2.5, pal.coatAccent);
  ctx.fillStyle = '#18142c';
  ctx.beginPath();
  ctx.arc(fHaX, fHaY, 2.9, 0, Math.PI * 2);
  ctx.fill();

  // Held RPG Signature Props per Guardian
  ctx.save();
  ctx.translate(fHaX, fHaY);
  if (heroId === 'sparxie') {
    // Golden Astral Compass Dial
    ctx.rotate(timeSec * 1.4);
    ctx.strokeStyle = '#f7d996';
    ctx.fillStyle = 'rgba(24, 20, 56, 0.9)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(4, -2, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fda4af';
    ctx.beginPath();
    ctx.moveTo(4, -6.5);
    ctx.lineTo(6.2, -2);
    ctx.lineTo(4, 2.5);
    ctx.lineTo(1.8, -2);
    ctx.closePath();
    ctx.fill();
  } else if (heroId === 'sparkle') {
    // Glowing Golden Illusion Card
    ctx.rotate(Math.sin(timeSec * 4) * 0.25 - 0.2);
    ctx.fillStyle = '#f7d996';
    ctx.strokeStyle = '#be123c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(1, -9, 8.5, 12, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7e22ce';
    ctx.beginPath();
    ctx.arc(5.2, -3, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (heroId === 'sampo') {
    // Fanned Emerald-Gold Broker Cards
    for (let c = -1; c <= 1; c += 1) {
      ctx.save();
      ctx.translate(4, -2);
      ctx.rotate(c * 0.34);
      ctx.fillStyle = c === 0 ? '#6ee7b7' : '#312e81';
      ctx.strokeStyle = '#f7d996';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(-3.5, -9, 7, 10, 1.5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  } else if (heroId === 'nihilux') {
    // Floating Cosmic Astrolabe Orb + Runic Halo
    ctx.translate(6, -4);
    ctx.strokeStyle = '#f7d996';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Shop Lentera Cakrawala orbiting hand/shoulder
  if (equippedAccessory === 'lentera_cakrawala') {
    const lx = Math.cos(timeSec * 3) * 26;
    const ly = -24 + Math.sin(timeSec * 4) * 7;
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#f7d996';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(lx, ly, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore(); // end front arm

  // 8. Attack Crescent Slash VFX (in facing coordinate space!)
  if (animState === 'attack') {
    const prog = clamp(1 - (opts.animTimer || 0) / 0.38, 0, 1);
    const alpha = Math.sin(prog * Math.PI);
    ctx.save();
    ctx.translate(18, hipBaseY - 14);
    ctx.globalAlpha = clamp(alpha * 1.15, 0, 1);
    const slashColor =
      heroId === 'sparkle'
        ? '#fb7185'
        : heroId === 'sampo'
          ? '#6ee7b7'
          : heroId === 'nihilux'
            ? '#c084fc'
            : '#f7d996';
    ctx.strokeStyle = slashColor;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 44, -Math.PI * 0.45, Math.PI * 0.48);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(4, 0, 42, -Math.PI * 0.38, Math.PI * 0.38);
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // end facing flip

  // 9. World-Space Role Signature Animations & Artifact Trophy Glow
  if (animState === 'artifact') {
    ctx.save();
    ctx.translate(0, hipBaseY - 56 + Math.sin(timeSec * 8) * 3);
    ctx.fillStyle = '#f7d996';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const r = i % 2 === 0 ? 11 : 4.5;
      const a = (Math.PI * i) / 4 + timeSec * 3;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  if (roleAnim === 'bonus') {
    // Sparkle Theatrical Bonus Shower: Orbiting Golden Cards & Starburst
    for (let i = 0; i < 6; i += 1) {
      const ang = timeSec * 3.5 + (Math.PI * 2 * i) / 6;
      const ox = Math.cos(ang) * 36;
      const oy = hipBaseY - 22 + Math.sin(ang * 1.5) * 18;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(ang);
      ctx.fillStyle = i % 2 === 0 ? '#f7d996' : '#fb7185';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.fillRect(-4, -6, 8, 12);
      ctx.strokeRect(-4, -6, 8, 12);
      ctx.restore();
    }
  } else if (roleAnim === 'clue') {
    // Sparxie Directional Radar Waves & Arrow Beam toward nearest artifact
    const waveR = ((timeSec * 52) % 44) + 18;
    ctx.save();
    ctx.translate(0, hipBaseY - 16);
    ctx.strokeStyle = `rgba(247, 217, 150, ${1 - (waveR - 18) / 44})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(0, 0, waveR, 0, Math.PI * 2);
    ctx.stroke();
    if (clueAngle !== null) {
      ctx.rotate(clueAngle);
      ctx.fillStyle = '#f7d996';
      ctx.beginPath();
      ctx.moveTo(46, 0);
      ctx.lineTo(34, -7);
      ctx.lineTo(37, 0);
      ctx.lineTo(34, 7);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (roleAnim === 'trick') {
    // Sampo Cunning Emerald-Gold Card Ring
    for (let i = 0; i < 4; i += 1) {
      const ang = -timeSec * 4 + (Math.PI * 2 * i) / 4;
      const ox = Math.cos(ang) * 34;
      const oy = hipBaseY - 16 + Math.sin(ang) * 12;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.rotate(Math.sin(timeSec * 6 + i) * 0.4);
      ctx.fillStyle = '#6ee7b7';
      ctx.strokeStyle = '#f7d996';
      ctx.lineWidth = 1.4;
      ctx.fillRect(-5, -7, 10, 14);
      ctx.strokeRect(-5, -7, 10, 14);
      ctx.restore();
    }
  } else if (roleAnim === 'cosmic') {
    // Nihilux Hexagonal Cosmic Barrier + Arcane Starlight
    ctx.save();
    ctx.translate(0, hipBaseY - 18);
    ctx.strokeStyle = 'rgba(221, 214, 254, 0.78)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI * i) / 3 + timeSec * 0.7;
      const px = Math.cos(a) * 38;
      const py = Math.sin(a) * 44;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(139, 92, 246, 0.12)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore(); // end scale
}

export function drawCosmicCompanion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heroId: HeroId,
  animState: HeroAnimState,
  timeSec: number,
  scale = 1
) {
  const pal = HERO_PALETTES[heroId] || HERO_PALETTES.sparxie;
  const bob = Math.sin(timeSec * 4.2) * 4.5;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.scale(scale, scale);

  // Astral Ribbon Tail
  const tw = Math.sin(timeSec * 6.5) * 4;
  ctx.fillStyle = pal.cosmicViolet;
  ctx.strokeStyle = pal.trimGold;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-6, 4);
  ctx.bezierCurveTo(-18, 6 + tw, -20, -4 - tw, -13, -7);
  ctx.quadraticCurveTo(-8, -1, -6, 4);
  ctx.fill();
  ctx.stroke();

  // Floating Mantle Cloak
  ctx.fillStyle = '#17153b';
  ctx.strokeStyle = pal.trimGold;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.quadraticCurveTo(0, -3, 8, 2);
  ctx.lineTo(10, 12);
  ctx.quadraticCurveTo(0, 16, -10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cute Star-Fox Head + Cosmic Ears
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#1e1b4b';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-9, -2);
  ctx.lineTo(-10, -14);
  ctx.lineTo(-3, -9);
  ctx.quadraticCurveTo(0, -10.5, 3, -9);
  ctx.lineTo(10, -14);
  ctx.lineTo(9, -2);
  ctx.quadraticCurveTo(9, 6, 0, 7);
  ctx.quadraticCurveTo(-9, 6, -9, -2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Expressive Companion Eyes
  ctx.strokeStyle = '#312e81';
  ctx.fillStyle = pal.eyeTop;
  ctx.lineWidth = 1.6;
  if (animState === 'artifact') {
    ctx.beginPath();
    ctx.arc(-3.5, -1, 2.2, Math.PI, Math.PI * 2);
    ctx.arc(3.5, -1, 2.2, Math.PI, Math.PI * 2);
    ctx.stroke();
  } else if (animState === 'hurt') {
    ctx.beginPath();
    ctx.moveTo(-5, -2.5);
    ctx.lineTo(-2, -1);
    ctx.lineTo(-5, 0.5);
    ctx.moveTo(5, -2.5);
    ctx.lineTo(2, -1);
    ctx.lineTo(5, 0.5);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-3.5, -1, 2.1, 0, Math.PI * 2);
    ctx.arc(3.5, -1, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-4.1, -1.7, 0.8, 0, Math.PI * 2);
    ctx.arc(2.9, -1.7, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing Gold Halo Star over Companion
  ctx.fillStyle = '#f7d996';
  ctx.beginPath();
  ctx.arc(0, -16, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawAnimeNpc(
  ctx: CanvasRenderingContext2D,
  npc: { id: string; name: string; planetId: PlanetId; accentColor: string; x: number; y: number },
  completed: boolean,
  nearby: boolean,
  timeSec: number
) {
  const bob = Math.sin(timeSec * 2.5 + npc.x * 0.01) * 1.8;
  const talkWave = nearby ? Math.sin(timeSec * 8) * 3.5 : 0;
  ctx.save();
  ctx.translate(npc.x, npc.y + bob);

  // Subtle aura under NPC
  ctx.fillStyle = completed ? 'rgba(52, 211, 153, 0.22)' : 'rgba(247, 217, 150, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Planet-themed cultural outfit & head silhouette
  const isTerra = npc.planetId === 'terra_nusantara';
  const isNova = npc.planetId === 'nova_metropolis';
  const isFusion = npc.planetId === 'fusion_kingdom';

  const robeMain = isTerra ? '#78350f' : isNova ? '#1e3a8a' : isFusion ? '#581c87' : '#311042';
  const sashColor = npc.accentColor;

  // Boots / feet
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-7, -8, 5, 8);
  ctx.fillRect(2, -8, 5, 8);

  // Detailed layered anime robe / coat / kebaya
  ctx.fillStyle = robeMain;
  ctx.strokeStyle = sashColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-10, -44);
  ctx.lineTo(-14, -7);
  ctx.quadraticCurveTo(0, -4, 14, -7);
  ctx.lineTo(10, -44);
  ctx.quadraticCurveTo(0, -47, -10, -44);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Cultural Selendang / Cyber Neon Scarf / Batik Trim
  ctx.fillStyle = sashColor;
  ctx.beginPath();
  ctx.moveTo(-9, -43);
  ctx.lineTo(6, -15);
  ctx.lineTo(9, -18);
  ctx.lineTo(-5, -45);
  ctx.closePath();
  ctx.fill();

  // Expressive gesturing arm + cultural prop
  ctx.strokeStyle = robeMain;
  ctx.lineWidth = 4.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(9, -39);
  ctx.lineTo(16, -28 - talkWave);
  ctx.stroke();
  ctx.fillStyle = '#fde6d8';
  ctx.beginPath();
  ctx.arc(16, -28 - talkWave, 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Sculpted anime NPC head & face
  ctx.fillStyle = '#fff0e5';
  ctx.strokeStyle = '#1e1026';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-10, -58);
  ctx.bezierCurveTo(-10.5, -50, -6.5, -45, 0, -44);
  ctx.bezierCurveTo(6.5, -45, 10.5, -50, 10, -58);
  ctx.bezierCurveTo(10, -67, -10, -67, -10, -58);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Anime eyes & friendly smile
  ctx.fillStyle = '#1e1b4b';
  ctx.beginPath();
  ctx.ellipse(-3.5, -55, 1.7, 2.2, 0, 0, Math.PI * 2);
  ctx.ellipse(3.5, -55, 1.7, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-4, -55.8, 0.7, 0, Math.PI * 2);
  ctx.arc(3, -55.8, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -50.2, 2.2, 0.15, Math.PI - 0.15);
  ctx.stroke();

  // Hair & Signature Headgear per NPC / Planet
  const hairCol = isTerra ? '#292524' : isNova ? '#38bdf8' : isFusion ? '#f472b6' : '#e2e8f0';
  ctx.fillStyle = hairCol;
  ctx.strokeStyle = '#181024';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-11, -55);
  ctx.bezierCurveTo(-12, -68, 12, -68, 11, -55);
  ctx.lineTo(6, -61);
  ctx.lineTo(0, -57);
  ctx.lineTo(-6, -61);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (npc.id === 'npc_bundo_sari') {
    // Minangkabau Tengkuluk horned headdress
    ctx.fillStyle = '#f7d996';
    ctx.strokeStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(-13, -64);
    ctx.lineTo(-17, -75);
    ctx.lineTo(0, -67);
    ctx.lineTo(17, -75);
    ctx.lineTo(13, -64);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (npc.id === 'npc_ki_taruna') {
    // Javanese Blangkon crest
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(0, -66, 11, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (isNova) {
    // Futuristic Holographic AR Visor
    ctx.fillStyle = 'rgba(56, 189, 248, 0.65)';
    ctx.fillRect(-8, -57, 16, 3.5);
  } else if (!isTerra) {
    // Astral Scholar / Fusion crown pin
    ctx.fillStyle = '#f7d996';
    ctx.beginPath();
    ctx.arc(0, -68, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Quest status floating marker
  const badgeY = -88 + Math.sin(timeSec * 4) * 3;
  ctx.fillStyle = completed ? '#34d399' : '#f7d996';
  ctx.strokeStyle = '#090d1e';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, badgeY, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#090d1e';
  ctx.font = '800 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(completed ? '✓' : '!', 0, badgeY + 4);

  // Clean NPC Nameplate
  ctx.font = '700 10.5px "Plus Jakarta Sans", sans-serif';
  const nw = ctx.measureText(npc.name).width + 12;
  ctx.fillStyle = 'rgba(7, 11, 24, 0.85)';
  ctx.beginPath();
  ctx.roundRect(-nw / 2, -110, nw, 16, 5);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(npc.name, 0, -98.5);

  ctx.restore();
}

export function drawAnimeBoss(
  ctx: CanvasRenderingContext2D,
  boss: { id: string; name: string; planetId: PlanetId; accentColor: string; x: number; y: number },
  defeated: boolean,
  canFight: boolean,
  timeSec: number,
  weakenedByNihilux = false
) {
  const hover = Math.sin(timeSec * 2.2) * 5;
  ctx.save();
  ctx.translate(boss.x, boss.y + hover);

  // Boss ground aura
  ctx.fillStyle = defeated ? 'rgba(52, 211, 153, 0.22)' : 'rgba(244, 63, 94, 0.26)';
  ctx.beginPath();
  ctx.ellipse(0, -hover, 40, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  if (weakenedByNihilux && !defeated) {
    ctx.strokeStyle = 'rgba(221, 214, 254, 0.82)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -68, 52, 64, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (boss.planetId === 'terra_nusantara') {
    // 1. Golem Pengabur Tradisi — Ancient Candi Armored Sentinel
    // Tattered obsidian-moss cloak
    ctx.fillStyle = '#14332a';
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-26, -86);
    ctx.lineTo(-34, -14);
    ctx.lineTo(0, -6);
    ctx.lineTo(34, -14);
    ctx.lineTo(26, -86);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sculpted Candi Stone Torso Armor + Emerald Core
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#f7d996';
    ctx.beginPath();
    ctx.moveTo(-22, -92);
    ctx.lineTo(22, -92);
    ctx.lineTo(15, -36);
    ctx.lineTo(-15, -36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Glowing Emerald Core
    ctx.fillStyle = defeated ? '#34d399' : '#fb7185';
    ctx.beginPath();
    ctx.moveTo(0, -76);
    ctx.lineTo(8, -64);
    ctx.lineTo(0, -52);
    ctx.lineTo(-8, -64);
    ctx.closePath();
    ctx.fill();

    // Floating Runic Gauntlets
    const gw = Math.sin(timeSec * 3) * 5;
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#f7d996';
    ctx.beginPath();
    ctx.roundRect(-38, -66 + gw, 12, 22, 4);
    ctx.roundRect(26, -66 - gw, 12, 22, 4);
    ctx.fill();
    ctx.stroke();

    // Kala-Mask Helm & Glowing Eyes
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(-14, -112);
    ctx.lineTo(0, -128);
    ctx.lineTo(14, -112);
    ctx.lineTo(11, -94);
    ctx.lineTo(-11, -94);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = defeated ? '#34d399' : '#fde047';
    ctx.fillRect(-7, -108, 4.5, 3);
    ctx.fillRect(2.5, -108, 4.5, 3);
  } else if (boss.planetId === 'nova_metropolis') {
    // 2. Droid Monokultur Siber — Sleek Cyber-Seraph Winged Sentinel
    // Twin Holographic Wing Blades
    ctx.fillStyle = 'rgba(56, 189, 248, 0.32)';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-14, -84);
    ctx.lineTo(-56, -118);
    ctx.lineTo(-42, -56);
    ctx.closePath();
    ctx.moveTo(14, -84);
    ctx.lineTo(56, -118);
    ctx.lineTo(42, -56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Sleek Mecha-Knight Frame
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(-18, -90);
    ctx.lineTo(18, -90);
    ctx.lineTo(10, -24);
    ctx.lineTo(0, -10);
    ctx.lineTo(-10, -24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Visor Halo Head
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(0, -106, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = defeated ? '#34d399' : '#f43f5e';
    ctx.fillRect(-10, -109, 20, 4.5);
  } else if (boss.planetId === 'fusion_kingdom') {
    // 3. Ilusi Tiruan Kosong — Masked Crimson-Violet Puppeteer
    // Jagged Masquerade Mantle
    ctx.fillStyle = '#3b0764';
    ctx.strokeStyle = '#f7d996';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-26, -88);
    ctx.lineTo(-36, -12);
    ctx.lineTo(-12, -22);
    ctx.lineTo(0, -8);
    ctx.lineTo(12, -22);
    ctx.lineTo(36, -12);
    ctx.lineTo(26, -88);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Floating Mirage Mirrors
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 34, -68 + Math.sin(timeSec * 3 + side) * 6);
      ctx.fillStyle = 'rgba(244, 114, 182, 0.35)';
      ctx.strokeStyle = '#f7d996';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 16, side * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Cracked Dual-Face Mask Head
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#9f1239';
    ctx.beginPath();
    ctx.arc(0, -104, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7e22ce';
    ctx.beginPath();
    ctx.arc(0, -104, 14, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();
    ctx.fillStyle = '#fb7185';
    ctx.fillRect(-7, -106, 4, 3);
    ctx.fillStyle = '#f7d996';
    ctx.fillRect(3, -106, 4, 3);
  } else {
    // 4. Arsitek Cultural Void — Abyssal Cosmic Archon
    // Triple Eclipse Halo
    ctx.save();
    ctx.translate(0, -102);
    ctx.rotate(timeSec * 0.8);
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#f7d996';
    ctx.beginPath();
    ctx.ellipse(0, 0, 42, 14, 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Celestial Archon Vestments
    ctx.fillStyle = '#120829';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-24, -90);
    ctx.lineTo(-34, -8);
    ctx.quadraticCurveTo(0, -2, 34, -8);
    ctx.lineTo(24, -90);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Abyssal Star Face + Crown
    ctx.fillStyle = '#090418';
    ctx.strokeStyle = '#f7d996';
    ctx.beginPath();
    ctx.moveTo(0, -128);
    ctx.lineTo(14, -102);
    ctx.lineTo(0, -86);
    ctx.lineTo(-14, -102);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = defeated ? '#34d399' : '#f43f5e';
    ctx.beginPath();
    ctx.arc(0, -104, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Boss Title Banner above head
  ctx.font = '800 11.5px "Outfit", sans-serif';
  const tw = ctx.measureText(boss.name).width + 20;
  ctx.fillStyle = 'rgba(10, 8, 28, 0.92)';
  ctx.strokeStyle = defeated ? '#34d399' : canFight ? '#fb7185' : '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -148, tw, 20, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = defeated ? '#34d399' : canFight ? '#fda4af' : '#cbd5e1';
  ctx.textAlign = 'center';
  ctx.fillText(defeated ? `${boss.name} (Ditaklukkan)` : `⚔ ${boss.name}`, 0, -134);

  ctx.restore();
}

export function drawVoidWisp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeSec: number
) {
  const pulse = 1 + Math.sin(timeSec * 6) * 0.12;
  ctx.save();
  ctx.translate(x, y + Math.sin(timeSec * 3.8) * 6);
  ctx.scale(pulse, pulse);

  // Swirling violet-crimson void tendrils
  ctx.strokeStyle = 'rgba(192, 132, 252, 0.72)';
  ctx.lineWidth = 2.4;
  for (let i = 0; i < 4; i += 1) {
    const a = timeSec * 3 + (Math.PI * 2 * i) / 4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(Math.cos(a + 0.6) * 14, Math.sin(a + 0.6) * 14, Math.cos(a) * 18, Math.sin(a) * 18);
    ctx.stroke();
  }

  // Dark Void Core + Glaring Crimson Eye
  ctx.fillStyle = '#1e0a36';
  ctx.strokeStyle = '#fb7185';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#f43f5e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 3.2, 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(-1, -1.5, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export type SignatureVfxKind =
  | 'sparkle_mask'
  | 'sparkle_stage'
  | 'sampo_wind'
  | 'sampo_cyclone'
  | 'nihilux_card_portal'
  | 'nihilux_rift'
  | 'sparxie_spark'
  | 'sparxie_firework';

export interface SignatureVfxItem {
  active: boolean;
  kind: SignatureVfxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  life: number;
  maxLife: number;
  seed: number;
}

export function drawSignatureWorldVfx(
  ctx: CanvasRenderingContext2D,
  vfx: SignatureVfxItem,
  timeSec: number
) {
  const progress = clamp(1 - vfx.life / Math.max(0.01, vfx.maxLife), 0, 1);
  const fade = progress < 0.72 ? 1 : clamp(1 - (progress - 0.72) / 0.28, 0, 1);
  ctx.save();
  ctx.translate(vfx.x, vfx.y);
  ctx.globalAlpha = fade;

  if (vfx.kind === 'sparkle_mask') {
    // Rotating crimson-gold Fox Mask projectile + pink illusion ribbon trail
    ctx.strokeStyle = 'rgba(251, 113, 133, 0.75)';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(-vfx.facing * 28, Math.sin(timeSec * 16 + vfx.seed) * 5);
    ctx.quadraticCurveTo(-vfx.facing * 12, -8, 0, 0);
    ctx.stroke();
    drawSparkleFoxMask(ctx, 0, 0, timeSec * 10 * vfx.facing + vfx.seed, 1.15);
  } else if (vfx.kind === 'sparkle_stage') {
    // Theatrical Crimson-Gold Stage Ring + Orbiting Masks
    const rad = 28 + easeOutCubic(progress) * 76;
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, rad, rad * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#f7d996';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, rad * 0.78, rad * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      const a = timeSec * 5 + (Math.PI * 2 * i) / 3;
      drawSparkleFoxMask(ctx, Math.cos(a) * rad * 0.85, Math.sin(a) * rad * 0.38 - 18, a * 0.5, 0.85);
    }
  } else if (vfx.kind === 'sampo_wind') {
    // Triple emerald-teal wind blade streaks
    ctx.scale(vfx.facing, 1);
    for (let i = -1; i <= 1; i += 1) {
      ctx.strokeStyle = i === 0 ? '#a7f3d0' : '#34d399';
      ctx.lineWidth = i === 0 ? 4.2 : 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(-6, i * 10, 26 + Math.abs(i) * 4, -0.75, 0.75);
      ctx.stroke();
    }
  } else if (vfx.kind === 'sampo_cyclone') {
    // Swirling emerald-cyan cyclone vortex
    const swell = 1 + easeOutCubic(progress) * 0.45;
    ctx.scale(swell, 1);
    for (let ring = 0; ring < 5; ring += 1) {
      const ry = -ring * 16 + 10;
      const rx = 18 + ring * 9;
      ctx.strokeStyle = ring % 2 === 0 ? '#6ee7b7' : '#a7f3d0';
      ctx.lineWidth = 3 - ring * 0.3;
      ctx.beginPath();
      ctx.ellipse(
        Math.sin(timeSec * 14 + ring) * 6,
        ry,
        rx,
        7,
        0,
        timeSec * 9 + ring,
        timeSec * 9 + ring + Math.PI * 1.45
      );
      ctx.stroke();
    }
  } else if (vfx.kind === 'nihilux_card_portal') {
    // Mini violet rift + spinning cosmic card projectile
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(-vfx.facing * 14, 0, 8, 20, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(timeSec * 9 * vfx.facing);
    ctx.fillStyle = '#3b0764';
    ctx.strokeStyle = '#f7d996';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.roundRect(-7, -10, 14, 20, 2.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e879f9';
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (vfx.kind === 'nihilux_rift') {
    // Grand dimensional rift portal + orbiting cosmic cards
    const open = easeOutCubic(Math.min(1, progress * 2.2));
    ctx.fillStyle = 'rgba(28, 12, 64, 0.78)';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 34 * open, 54 * open, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#f7d996';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 23 * open, 40 * open, Math.sin(timeSec * 3) * 0.25, 0, Math.PI * 2);
    ctx.stroke();
    for (let c = 0; c < 4; c += 1) {
      const a = timeSec * 4.5 + (Math.PI * 2 * c) / 4;
      const cx = Math.cos(a) * 44 * open;
      const cy = Math.sin(a) * 32 * open;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a + 0.5);
      ctx.fillStyle = '#a855f7';
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1.2;
      ctx.fillRect(-4.5, -6.5, 9, 13);
      ctx.strokeRect(-4.5, -6.5, 9, 13);
      ctx.restore();
    }
  } else if (vfx.kind === 'sparxie_spark') {
    // Radiant golden-pink spark bolt
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#fb7185';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const r = i % 2 === 0 ? 12 : 4.5;
      const a = (Math.PI * i) / 4 + timeSec * 8;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (vfx.kind === 'sparxie_firework') {
    // Festive multi-color layered firework explosion
    const burst = easeOutCubic(progress);
    const colors = ['#f7d996', '#fb7185', '#38bdf8', '#c084fc', '#34d399'];
    for (let i = 0; i < 14; i += 1) {
      const ang = (Math.PI * 2 * i) / 14 + vfx.seed;
      const dist = 16 + burst * 82;
      const px = Math.cos(ang) * dist;
      const py = Math.sin(ang) * dist + burst * 16;
      ctx.strokeStyle = colors[i % colors.length];
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(px * 0.55, py * 0.55);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, 2.8 * (1 - burst * 0.4), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
