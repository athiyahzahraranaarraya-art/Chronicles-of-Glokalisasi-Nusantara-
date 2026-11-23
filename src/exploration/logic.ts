import {
  BOSS_ENCOUNTERS,
  EXPLORATION_SUPPLIES,
  EXPLORER_ACCESSORIES,
  GUARDIAN_EXPLORE_POWERS,
  PLANETS,
  RELICS,
  WORKSHOP_INGREDIENTS,
  WORKSHOP_RECIPES,
  getRelicById,
} from './data';
import type {
  CodexStats,
  ExplorationActivity,
  ExplorationProgress,
  HeroId,
  PlanetId,
  PlanetWorldLayout,
  RelicCategory,
  RelicItem,
  RelicTier,
  SpotEncounter,
  WorkshopRecipe,
  WorldGate,
} from './types';

export const EXPLORATION_STORAGE_KEY = 'honkai_glokalisasi_exploration_v1';

const ALL_PLANET_IDS: PlanetId[] = [
  'terra_nusantara',
  'nova_metropolis',
  'fusion_kingdom',
  'lost_civilization',
];

const VALID_RELIC_IDS = new Set(RELICS.map((r) => r.id));
const VALID_ACCESSORY_IDS = new Set(EXPLORER_ACCESSORIES.map((a) => a.id));

export function createDefaultExplorationProgress(): ExplorationProgress {
  return {
    discoveredRelics: [],
    discoveryLog: [],
    openedChests: [],
    solvedNpcs: [],
    solvedPuzzles: [],
    inspectedSpots: [],
    defeatedBosses: [],
    completedPlanets: [],
    unlockedPlanets: ['terra_nusantara'],
    glocalCrystals: 0,
    craftedRecipes: [],
    ownedAccessories: ['none'],
    equippedAccessory: 'none',
    activePlanet: 'terra_nusantara',
    exploreSp: 100,
    maxExploreSp: 100,
    spPotions: 2,
    hintTokens: 2,
    activatedSwitches: [],
    unlockedGates: [],
    solvedActivities: [],
    dilemmaChoices: {},
    readClues: [],
    visitedZones: [],
    activatedMechanisms: [],
  };
}

export function normalizeExplorationProgress(raw: unknown): ExplorationProgress {
  const base = createDefaultExplorationProgress();
  if (!raw || typeof raw !== 'object') return base;
  const src = raw as Partial<ExplorationProgress>;

  const discoveredRelics = Array.isArray(src.discoveredRelics)
    ? Array.from(new Set(src.discoveredRelics.filter((id) => typeof id === 'string' && VALID_RELIC_IDS.has(id))))
    : [];

  const discoveryLog = Array.isArray(src.discoveryLog)
    ? src.discoveryLog
        .filter(
          (entry) =>
            entry &&
            typeof entry.relicId === 'string' &&
            VALID_RELIC_IDS.has(entry.relicId) &&
            typeof entry.method === 'string'
        )
        .slice(0, 100)
    : [];

  const filterStrings = (arr: unknown) =>
    Array.isArray(arr) ? Array.from(new Set(arr.filter((s): s is string => typeof s === 'string'))) : [];

  const unlockedPlanets = Array.isArray(src.unlockedPlanets)
    ? Array.from(
        new Set([
          'terra_nusantara' as PlanetId,
          ...src.unlockedPlanets.filter((p): p is PlanetId => ALL_PLANET_IDS.includes(p as PlanetId)),
        ])
      )
    : ['terra_nusantara' as PlanetId];

  const completedPlanets = Array.isArray(src.completedPlanets)
    ? Array.from(
        new Set(src.completedPlanets.filter((p): p is PlanetId => ALL_PLANET_IDS.includes(p as PlanetId)))
      )
    : [];

  const ownedAccessories = Array.isArray(src.ownedAccessories)
    ? Array.from(
        new Set([
          'none',
          ...src.ownedAccessories.filter((id) => typeof id === 'string' && VALID_ACCESSORY_IDS.has(id)),
        ])
      )
    : ['none'];

  const equippedAccessory =
    typeof src.equippedAccessory === 'string' && ownedAccessories.includes(src.equippedAccessory)
      ? src.equippedAccessory
      : 'none';

  const activePlanet =
    typeof src.activePlanet === 'string' && unlockedPlanets.includes(src.activePlanet as PlanetId)
      ? (src.activePlanet as PlanetId)
      : 'terra_nusantara';

  const maxExploreSp =
    typeof src.maxExploreSp === 'number' && Number.isFinite(src.maxExploreSp) && src.maxExploreSp >= 50
      ? Math.round(src.maxExploreSp)
      : 100;
  const exploreSp =
    typeof src.exploreSp === 'number' && Number.isFinite(src.exploreSp)
      ? Math.max(0, Math.min(maxExploreSp, Math.round(src.exploreSp)))
      : maxExploreSp;
  const spPotions =
    typeof src.spPotions === 'number' && Number.isFinite(src.spPotions) && src.spPotions >= 0
      ? Math.round(src.spPotions)
      : 2;
  const hintTokens =
    typeof src.hintTokens === 'number' && Number.isFinite(src.hintTokens) && src.hintTokens >= 0
      ? Math.round(src.hintTokens)
      : 2;

  const dilemmaChoices: Record<string, string> = {};
  if (src.dilemmaChoices && typeof src.dilemmaChoices === 'object') {
    for (const [k, v] of Object.entries(src.dilemmaChoices)) {
      if (typeof k === 'string' && typeof v === 'string') {
        dilemmaChoices[k] = v;
      }
    }
  }

  return {
    discoveredRelics,
    discoveryLog,
    openedChests: filterStrings(src.openedChests),
    solvedNpcs: filterStrings(src.solvedNpcs),
    solvedPuzzles: filterStrings(src.solvedPuzzles),
    inspectedSpots: filterStrings(src.inspectedSpots),
    defeatedBosses: filterStrings(src.defeatedBosses),
    completedPlanets,
    unlockedPlanets,
    glocalCrystals:
      typeof src.glocalCrystals === 'number' && Number.isFinite(src.glocalCrystals) && src.glocalCrystals >= 0
        ? Math.round(src.glocalCrystals)
        : 0,
    craftedRecipes: filterStrings(src.craftedRecipes),
    ownedAccessories,
    equippedAccessory,
    activePlanet,
    exploreSp,
    maxExploreSp,
    spPotions,
    hintTokens,
    activatedSwitches: filterStrings(src.activatedSwitches),
    unlockedGates: filterStrings(src.unlockedGates),
    solvedActivities: filterStrings(src.solvedActivities),
    dilemmaChoices,
    readClues: filterStrings(src.readClues),
    visitedZones: filterStrings(src.visitedZones),
    activatedMechanisms: filterStrings(src.activatedMechanisms),
  };
}

export function loadExplorationProgress(storageObj?: Storage | null): ExplorationProgress {
  const store = storageObj || (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null);
  if (!store) return createDefaultExplorationProgress();
  try {
    const raw = store.getItem(EXPLORATION_STORAGE_KEY);
    if (!raw) return createDefaultExplorationProgress();
    return normalizeExplorationProgress(JSON.parse(raw));
  } catch {
    return createDefaultExplorationProgress();
  }
}

export function saveExplorationProgress(
  progress: ExplorationProgress,
  storageObj?: Storage | null
): ExplorationProgress {
  const clean = normalizeExplorationProgress(progress);
  const store = storageObj || (typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null);
  if (store) {
    try {
      store.setItem(EXPLORATION_STORAGE_KEY, JSON.stringify(clean));
    } catch {
      // Ignore quota errors
    }
  }
  return clean;
}

export function getCodexStats(progress: ExplorationProgress): CodexStats {
  const foundSet = new Set(progress.discoveredRelics);
  const byCategory: Record<RelicCategory, { found: number; total: number }> = {
    local: { found: 0, total: 0 },
    global: { found: 0, total: 0 },
    glocal: { found: 0, total: 0 },
    lost: { found: 0, total: 0 },
  };
  const byPlanet: Record<PlanetId, { found: number; total: number }> = {
    terra_nusantara: { found: 0, total: 0 },
    nova_metropolis: { found: 0, total: 0 },
    fusion_kingdom: { found: 0, total: 0 },
    lost_civilization: { found: 0, total: 0 },
  };

  let totalFound = 0;
  for (const relic of RELICS) {
    byCategory[relic.category].total += 1;
    byPlanet[relic.planetId].total += 1;
    if (foundSet.has(relic.id)) {
      byCategory[relic.category].found += 1;
      byPlanet[relic.planetId].found += 1;
      totalFound += 1;
    }
  }

  return {
    totalFound,
    totalRelics: RELICS.length,
    completionPct: RELICS.length > 0 ? Math.round((totalFound / RELICS.length) * 100) : 0,
    byCategory,
    byPlanet,
  };
}

export function unlockRelicInProgress(
  progress: ExplorationProgress,
  relicId: string,
  methodLabel: string,
  timestampStr?: string
): { progress: ExplorationProgress; newlyDiscovered: boolean } {
  const clean = normalizeExplorationProgress(progress);
  const relic = getRelicById(relicId);
  if (!relic) {
    return { progress: clean, newlyDiscovered: false };
  }
  if (clean.discoveredRelics.includes(relicId)) {
    return { progress: clean, newlyDiscovered: false };
  }

  const timestamp = timestampStr || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const next = normalizeExplorationProgress({
    ...clean,
    discoveredRelics: [...clean.discoveredRelics, relicId],
    discoveryLog: [
      { relicId, planetId: relic.planetId, method: methodLabel, timestamp },
      ...clean.discoveryLog,
    ].slice(0, 100),
  });

  return { progress: next, newlyDiscovered: true };
}

export interface SpotAccessResult {
  accessible: boolean;
  reason?: 'guarded' | 'gated';
  guardWispId?: string;
  foundRelics?: number;
  requiredRelics?: number;
  missingRelics?: number;
}

export function evaluateSpotAccess(
  spot: SpotEncounter,
  progress: ExplorationProgress,
  defeatedWispIds: string[]
): SpotAccessResult {
  if (spot.guardWispId && !defeatedWispIds.includes(spot.guardWispId)) {
    return {
      accessible: false,
      reason: 'guarded',
      guardWispId: spot.guardWispId,
    };
  }
  if (typeof spot.requiresPlanetRelics === 'number' && spot.requiresPlanetRelics > 0) {
    const stats = getCodexStats(progress);
    const foundRelics = stats.byPlanet[spot.planetId]?.found ?? 0;
    if (foundRelics < spot.requiresPlanetRelics) {
      return {
        accessible: false,
        reason: 'gated',
        foundRelics,
        requiredRelics: spot.requiresPlanetRelics,
        missingRelics: spot.requiresPlanetRelics - foundRelics,
      };
    }
  }
  return { accessible: true };
}

export function canChallengePlanetBoss(progress: ExplorationProgress, planetId: PlanetId): {
  allowed: boolean;
  foundCount: number;
  requiredCount: number;
} {
  const planet = PLANETS.find((p) => p.id === planetId) || PLANETS[0];
  const stats = getCodexStats(progress);
  const foundCount = stats.byPlanet[planetId].found;
  return {
    allowed: foundCount >= planet.minRelicsToBoss,
    foundCount,
    requiredCount: planet.minRelicsToBoss,
  };
}

export function completePlanetBoss(
  progress: ExplorationProgress,
  planetId: PlanetId
): { progress: ExplorationProgress; unlockedNextPlanet: PlanetId | null; newlyDefeated: boolean; rewardJades: number } {
  const clean = normalizeExplorationProgress(progress);
  const boss = BOSS_ENCOUNTERS[planetId];
  const newlyDefeated = !clean.defeatedBosses.includes(boss.id);

  const unlockedRes = unlockRelicInProgress(clean, boss.rewardRelicId, `Menaklukkan ${boss.name}`);
  let next = unlockedRes.progress;

  const idx = ALL_PLANET_IDS.indexOf(planetId);
  const nextPlanetId = idx >= 0 && idx + 1 < ALL_PLANET_IDS.length ? ALL_PLANET_IDS[idx + 1] : null;

  const nextUnlocked = nextPlanetId && !next.unlockedPlanets.includes(nextPlanetId)
    ? [...next.unlockedPlanets, nextPlanetId]
    : next.unlockedPlanets;

  next = normalizeExplorationProgress({
    ...next,
    defeatedBosses: newlyDefeated ? [...next.defeatedBosses, boss.id] : next.defeatedBosses,
    unlockedPlanets: nextUnlocked,
  });

  const rewardJades = newlyDefeated ? boss.rewardJades : 0;
  return {
    progress: next,
    unlockedNextPlanet: nextPlanetId && !clean.unlockedPlanets.includes(nextPlanetId) ? nextPlanetId : null,
    newlyDefeated,
    rewardJades,
  };
}

export function checkFullPlanetCollectionBonus(
  progress: ExplorationProgress,
  planetId: PlanetId
): { eligible: boolean; found: number; total: number } {
  const stats = getCodexStats(progress);
  const info = stats.byPlanet[planetId];
  return {
    eligible: info.found >= info.total,
    found: info.found,
    total: info.total,
  };
}

export function claimFullPlanetBonus(
  progress: ExplorationProgress,
  planetId: PlanetId
): { progress: ExplorationProgress; awarded: boolean; bonusJades: number; found: number; total: number } {
  const clean = normalizeExplorationProgress(progress);
  const check = checkFullPlanetCollectionBonus(clean, planetId);
  if (!check.eligible || clean.completedPlanets.includes(planetId)) {
    return {
      progress: clean,
      awarded: false,
      bonusJades: 0,
      found: check.found,
      total: check.total,
    };
  }
  const planet = PLANETS.find((p) => p.id === planetId) || PLANETS[0];
  const next = normalizeExplorationProgress({
    ...clean,
    completedPlanets: [...clean.completedPlanets, planetId],
  });
  return {
    progress: next,
    awarded: true,
    bonusJades: planet.completionRewardJades || 50,
    found: check.found,
    total: check.total,
  };
}

export function getGuardianPower(heroId: HeroId) {
  return GUARDIAN_EXPLORE_POWERS[heroId] || GUARDIAN_EXPLORE_POWERS.sparxie;
}

export function evaluateWorkshopCombination(
  localId: string,
  globalId: string
): {
  valid: boolean;
  recipe: WorkshopRecipe | null;
  feedback: string;
} {
  const localItem = WORKSHOP_INGREDIENTS.find((i) => i.id === localId && i.side === 'local');
  const globalItem = WORKSHOP_INGREDIENTS.find((i) => i.id === globalId && i.side === 'global');

  if (!localItem || !globalItem) {
    return {
      valid: false,
      recipe: null,
      feedback: 'Pilih 1 Unsur Budaya Lokal dan 1 Pengaruh Global terlebih dahulu.',
    };
  }

  const recipe = WORKSHOP_RECIPES.find((r) => r.localId === localId && r.globalId === globalId) || null;
  if (recipe) {
    return {
      valid: true,
      recipe,
      feedback: `Berhasil merancang ${recipe.resultName}! Jawab pertanyaan analisis berikut untuk memperoleh Glocal Crystals.`,
    };
  }

  return {
    valid: false,
    recipe: null,
    feedback: `Kombinasi "${localItem.name}" dengan "${globalItem.name}" belum membentuk adaptasi glokalisasi yang selaras. Ingat: glokalisasi bukan sekadar menempelkan dua hal berbeda, melainkan menemukan kecocokan fungsi, medium, dan nilai budaya. Coba pasangkan unsur lokal dengan medium global yang tepat!`,
  };
}

export function evaluateWorkshopQuiz(
  progress: ExplorationProgress,
  recipe: WorkshopRecipe,
  selectedIndex: number
): {
  isCorrect: boolean;
  progress: ExplorationProgress;
  crystalGained: number;
  jadeGained: number;
  explanation: string;
} {
  const clean = normalizeExplorationProgress(progress);
  const isCorrect = selectedIndex === recipe.correctIndex;
  if (!isCorrect) {
    return {
      isCorrect: false,
      progress: clean,
      crystalGained: 0,
      jadeGained: 0,
      explanation: `Belum tepat. ${recipe.explanation}`,
    };
  }

  const firstCraft = !clean.craftedRecipes.includes(recipe.id);
  const unlockedRes = unlockRelicInProgress(clean, recipe.resultRelicId, `Glocalization Workshop: ${recipe.resultName}`);
  const crystalGained = firstCraft ? recipe.crystalReward : 0;
  const jadeGained = firstCraft ? recipe.jadeReward : 5;

  const next = normalizeExplorationProgress({
    ...unlockedRes.progress,
    craftedRecipes: firstCraft
      ? [...unlockedRes.progress.craftedRecipes, recipe.id]
      : unlockedRes.progress.craftedRecipes,
    glocalCrystals: unlockedRes.progress.glocalCrystals + crystalGained,
  });

  return {
    isCorrect: true,
    progress: next,
    crystalGained,
    jadeGained,
    explanation: recipe.explanation,
  };
}

export function shuffleOptionsKeepAnswer(
  options: string[],
  correctIndex: number,
  rngFn?: () => number
): { options: string[]; correctIndex: number } {
  const rand = typeof rngFn === 'function' ? rngFn : Math.random;
  const indexed = options.map((text, idx) => ({ text, isRight: idx === correctIndex }));
  for (let i = indexed.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = indexed[i];
    indexed[i] = indexed[j];
    indexed[j] = tmp;
  }
  return {
    options: indexed.map((item) => item.text),
    correctIndex: Math.max(0, indexed.findIndex((item) => item.isRight)),
  };
}

export function purchaseExplorerAccessory(
  progress: ExplorationProgress,
  currentJades: number,
  accessoryId: string
): {
  ok: boolean;
  alreadyOwned?: boolean;
  reason?: string;
  cost: number;
  progress: ExplorationProgress;
} {
  const clean = normalizeExplorationProgress(progress);
  const item = EXPLORER_ACCESSORIES.find((a) => a.id === accessoryId);
  if (!item) {
    return { ok: false, reason: 'Aksesori tidak ditemukan.', cost: 0, progress: clean };
  }
  if (clean.ownedAccessories.includes(item.id)) {
    return {
      ok: true,
      alreadyOwned: true,
      cost: 0,
      progress: normalizeExplorationProgress({ ...clean, equippedAccessory: item.id }),
    };
  }
  if (currentJades < item.price) {
    return {
      ok: false,
      reason: `Stellar Jades kurang ${item.price - currentJades} lagi.`,
      cost: 0,
      progress: clean,
    };
  }
  return {
    ok: true,
    alreadyOwned: false,
    cost: item.price,
    progress: normalizeExplorationProgress({
      ...clean,
      ownedAccessories: [...clean.ownedAccessories, item.id],
      equippedAccessory: item.id,
    }),
  };
}

export function getRelicTier(relic: RelicItem): RelicTier {
  if (
    relic.discoveryMethod === 'secret_passage' ||
    relic.discoveryMethod === 'behind_building' ||
    relic.discoveryMethod === 'gated_area' ||
    relic.discoveryMethod === 'platform'
  ) {
    return 'tersembunyi';
  }
  if (relic.category === 'lost' || relic.isConceptualCreation) {
    return 'arsip';
  }
  return 'utama';
}

export function consumeExploreSp(
  progress: ExplorationProgress,
  cost: number
): { ok: boolean; progress: ExplorationProgress; sp: number; maxSp: number } {
  const clean = normalizeExplorationProgress(progress);
  const current = clean.exploreSp ?? 100;
  const maxSp = clean.maxExploreSp ?? 100;
  if (cost <= 0) {
    return { ok: true, progress: clean, sp: current, maxSp };
  }
  if (current < cost) {
    return { ok: false, progress: clean, sp: current, maxSp };
  }
  const nextSp = Math.max(0, current - Math.round(cost));
  return {
    ok: true,
    progress: normalizeExplorationProgress({ ...clean, exploreSp: nextSp }),
    sp: nextSp,
    maxSp,
  };
}

export function recoverExploreSp(
  progress: ExplorationProgress,
  amount: number
): { progress: ExplorationProgress; gained: number; sp: number; maxSp: number } {
  const clean = normalizeExplorationProgress(progress);
  const current = clean.exploreSp ?? 100;
  const maxSp = clean.maxExploreSp ?? 100;
  const nextSp = Math.min(maxSp, current + Math.max(0, Math.round(amount)));
  return {
    progress: normalizeExplorationProgress({ ...clean, exploreSp: nextSp }),
    gained: nextSp - current,
    sp: nextSp,
    maxSp,
  };
}

export function purchaseExplorationSupply(
  progress: ExplorationProgress,
  currentJades: number,
  supplyId: 'sp_elixir' | 'hint_lens' | 'astra_tonic'
): {
  ok: boolean;
  reason?: string;
  cost: number;
  hpBonus: number;
  progress: ExplorationProgress;
} {
  const clean = normalizeExplorationProgress(progress);
  const item = EXPLORATION_SUPPLIES.find((s) => s.id === supplyId);
  if (!item) {
    return { ok: false, reason: 'Perbekalan tidak ditemukan.', cost: 0, hpBonus: 0, progress: clean };
  }
  if (currentJades < item.price) {
    return {
      ok: false,
      reason: `Stellar Jades kurang ${item.price - currentJades} lagi.`,
      cost: 0,
      hpBonus: 0,
      progress: clean,
    };
  }

  const maxSp = clean.maxExploreSp ?? 100;
  let nextSp = clean.exploreSp ?? 100;
  let nextPotions = clean.spPotions ?? 2;
  let nextHints = clean.hintTokens ?? 2;
  let hpBonus = 0;

  if (supplyId === 'sp_elixir') {
    nextPotions += 1;
  } else if (supplyId === 'hint_lens') {
    nextHints += 2;
  } else if (supplyId === 'astra_tonic') {
    nextSp = maxSp;
    nextHints += 1;
    hpBonus = 25;
  }

  return {
    ok: true,
    cost: item.price,
    hpBonus,
    progress: normalizeExplorationProgress({
      ...clean,
      exploreSp: nextSp,
      spPotions: nextPotions,
      hintTokens: nextHints,
    }),
  };
}

export function useSpPotion(progress: ExplorationProgress): {
  ok: boolean;
  reason?: string;
  progress: ExplorationProgress;
  gained: number;
} {
  const clean = normalizeExplorationProgress(progress);
  const potions = clean.spPotions ?? 0;
  const current = clean.exploreSp ?? 100;
  const maxSp = clean.maxExploreSp ?? 100;
  if (potions <= 0) {
    return { ok: false, reason: 'Stok Ramuan SP habis. Beli di Toko atau sentuh Kristal Energi di peta!', progress: clean, gained: 0 };
  }
  if (current >= maxSp) {
    return { ok: false, reason: 'Exploration SP sudah penuh!', progress: clean, gained: 0 };
  }
  const nextSp = Math.min(maxSp, current + 50);
  return {
    ok: true,
    gained: nextSp - current,
    progress: normalizeExplorationProgress({
      ...clean,
      exploreSp: nextSp,
      spPotions: potions - 1,
    }),
  };
}

export function evaluateClassificationPuzzle(
  activity: ExplorationActivity,
  assignments: Record<string, string>
): { valid: boolean; correctCount: number; totalCount: number; feedback: string } {
  const items = activity.items || [];
  let correctCount = 0;
  for (const item of items) {
    if (assignments[item.id] === item.group) {
      correctCount += 1;
    }
  }
  const totalCount = items.length;
  const valid = totalCount > 0 && correctCount === totalCount;
  return {
    valid,
    correctCount,
    totalCount,
    feedback: valid
      ? `Sempurna! Semua ${totalCount} unsur berhasil dikelompokkan dengan tepat.`
      : `${correctCount} dari ${totalCount} pengelompokan sudah tepat. Periksa kembali fungsi & sifat budaya item yang keliru!`,
  };
}

export function evaluateSequencePuzzle(
  activity: ExplorationActivity,
  orderedStepIds: string[]
): { valid: boolean; matchedPositions: number; totalPositions: number; feedback: string } {
  const steps = [...(activity.steps || [])].sort((a, b) => a.correctOrder - b.correctOrder);
  const totalPositions = steps.length;
  let matchedPositions = 0;
  for (let i = 0; i < steps.length; i += 1) {
    if (orderedStepIds[i] === steps[i].id) {
      matchedPositions += 1;
    }
  }
  const valid = totalPositions > 0 && matchedPositions === totalPositions;
  return {
    valid,
    matchedPositions,
    totalPositions,
    feedback: valid
      ? 'Urutan tepat! Alur pelestarian dan inovasi glokalisasi berjalan selaras.'
      : `${matchedPositions} dari ${totalPositions} posisi sudah benar. Ingat: dokumentasi & penghargaan asal selalu mendahului pemasaran.`,
  };
}

export function evaluateGateCodePuzzle(
  gate: WorldGate,
  selectedCode: string
): { valid: boolean; feedback: string } {
  const normalized = selectedCode.trim();
  const valid = Boolean(gate.gateCode && normalized === gate.gateCode);
  return {
    valid,
    feedback: valid
      ? `Kode ${normalized} diterima! ${gate.label} kini terbuka.`
      : `Kode "${normalized}" belum cocok. Baca Prasasti/Terminal Petunjuk di sekitar area ini untuk mendapatkan kode pasti!`,
  };
}

export function recordDilemmaChoice(
  progress: ExplorationProgress,
  activityId: string,
  choiceId: string
): { progress: ExplorationProgress; firstTime: boolean } {
  const clean = normalizeExplorationProgress(progress);
  const firstTime = !(clean.solvedActivities || []).includes(activityId);
  return {
    progress: normalizeExplorationProgress({
      ...clean,
      solvedActivities: firstTime ? [...(clean.solvedActivities || []), activityId] : clean.solvedActivities,
      dilemmaChoices: { ...(clean.dilemmaChoices || {}), [activityId]: choiceId },
    }),
    firstTime,
  };
}

export function getGraduatedHintStage(
  hints: [string, string, string],
  stageIndex: number
): { stage: 1 | 2 | 3; text: string; hasNext: boolean } {
  const clamped = Math.max(0, Math.min(2, stageIndex));
  return {
    stage: (clamped + 1) as 1 | 2 | 3,
    text: hints[clamped],
    hasNext: clamped < 2,
  };
}

export function activateWorldSwitch(
  progress: ExplorationProgress,
  switchId: string,
  gateId?: string
): { progress: ExplorationProgress; newlyActivated: boolean } {
  const clean = normalizeExplorationProgress(progress);
  const switches = clean.activatedSwitches || [];
  const gates = clean.unlockedGates || [];
  const newlyActivated = !switches.includes(switchId);
  const nextSwitches = newlyActivated ? [...switches, switchId] : switches;
  const nextGates = gateId && !gates.includes(gateId) ? [...gates, gateId] : gates;
  return {
    progress: normalizeExplorationProgress({
      ...clean,
      activatedSwitches: nextSwitches,
      unlockedGates: nextGates,
    }),
    newlyActivated,
  };
}

export function unlockWorldGate(
  progress: ExplorationProgress,
  gateId: string
): { progress: ExplorationProgress; newlyUnlocked: boolean } {
  const clean = normalizeExplorationProgress(progress);
  const gates = clean.unlockedGates || [];
  const newlyUnlocked = !gates.includes(gateId);
  return {
    progress: normalizeExplorationProgress({
      ...clean,
      unlockedGates: newlyUnlocked ? [...gates, gateId] : gates,
    }),
    newlyUnlocked,
  };
}

export function markClueRead(
  progress: ExplorationProgress,
  clueId: string
): { progress: ExplorationProgress; firstRead: boolean } {
  const clean = normalizeExplorationProgress(progress);
  const read = clean.readClues || [];
  const firstRead = !read.includes(clueId);
  return {
    progress: normalizeExplorationProgress({
      ...clean,
      readClues: firstRead ? [...read, clueId] : read,
    }),
    firstRead,
  };
}

export function markVisitedZone(
  progress: ExplorationProgress,
  zoneKey: string
): { progress: ExplorationProgress; newlyVisited: boolean } {
  const clean = normalizeExplorationProgress(progress);
  const visited = clean.visitedZones || [];
  const newlyVisited = !visited.includes(zoneKey);
  if (!newlyVisited) return { progress: clean, newlyVisited: false };
  return {
    progress: normalizeExplorationProgress({
      ...clean,
      visitedZones: [...visited, zoneKey],
    }),
    newlyVisited: true,
  };
}

export function activateGuardianMechanism(
  progress: ExplorationProgress,
  mechanismId: string,
  targetGateId?: string
): { progress: ExplorationProgress; newlyActivated: boolean } {
  const clean = normalizeExplorationProgress(progress);
  const mechs = clean.activatedMechanisms || [];
  const gates = clean.unlockedGates || [];
  const newlyActivated = !mechs.includes(mechanismId);
  return {
    progress: normalizeExplorationProgress({
      ...clean,
      activatedMechanisms: newlyActivated ? [...mechs, mechanismId] : mechs,
      unlockedGates: targetGateId && !gates.includes(targetGateId) ? [...gates, targetGateId] : gates,
    }),
    newlyActivated,
  };
}

export interface ZoneMapEntry {
  zoneKey: string;
  name: string;
  kind: string;
  x: number;
  visited: boolean;
  activitiesDone: number;
  activitiesTotal: number;
  gatesUnlocked: number;
  gatesTotal: number;
}

export function getPlanetZoneMapSummary(
  planetId: PlanetId,
  progress: ExplorationProgress,
  layout: PlanetWorldLayout
): ZoneMapEntry[] {
  const clean = normalizeExplorationProgress(progress);
  const visitedSet = new Set(clean.visitedZones || []);
  const solvedActSet = new Set(clean.solvedActivities || []);
  const gateSet = new Set(clean.unlockedGates || []);

  const landmarks = layout.landmarks || [];
  return landmarks.map((lm, idx) => {
    const prevX = idx === 0 ? 0 : (landmarks[idx - 1].x + lm.x) / 2;
    const nextX = idx === landmarks.length - 1 ? layout.worldWidth : (lm.x + landmarks[idx + 1].x) / 2;
    const zoneKey = `${planetId}:${lm.name}`;
    const actsInZone = (layout.activitySpots || []).filter((a) => a.x >= prevX && a.x < nextX);
    const gatesInZone = (layout.gates || []).filter((g) => g.x >= prevX && g.x < nextX);
    return {
      zoneKey,
      name: lm.name,
      kind: lm.kind,
      x: lm.x,
      visited: visitedSet.has(zoneKey),
      activitiesDone: actsInZone.filter((a) => solvedActSet.has(a.activityId)).length,
      activitiesTotal: actsInZone.length,
      gatesUnlocked: gatesInZone.filter((g) => gateSet.has(g.id)).length,
      gatesTotal: gatesInZone.length,
    };
  });
}
