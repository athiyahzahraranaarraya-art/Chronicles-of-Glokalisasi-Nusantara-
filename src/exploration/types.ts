export type PlanetId =
  | 'terra_nusantara'
  | 'nova_metropolis'
  | 'fusion_kingdom'
  | 'lost_civilization';

export type RelicCategory = 'local' | 'global' | 'glocal' | 'lost';

export type RelicRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type DiscoveryMethod =
  | 'npc'
  | 'chest'
  | 'puzzle'
  | 'platform'
  | 'behind_building'
  | 'secret_passage'
  | 'monster_guard'
  | 'gated_area'
  | 'guardian_challenge'
  | 'boss';

export type HeroId = 'sparxie' | 'sparkle' | 'sampo' | 'nihilux';

export interface PlanetInfo {
  id: PlanetId;
  order: number;
  name: string;
  subtitle: string;
  theme: string;
  motto: string;
  environments: string[];
  guardianIntro: string;
  missionLabel: string;
  minRelicsToBoss: number;
  completionRewardJades: number;
  accentColor: string;
  skyColors: [string, string, string];
  groundColor: string;
  platformColor: string;
  worldWidth: number;
}

export interface RelicItem {
  id: string;
  name: string;
  planetId: PlanetId;
  category: RelicCategory;
  rarity: RelicRarity;
  discoveryMethod: DiscoveryMethod;
  isConceptualCreation?: boolean;
  subCategory: string;
  origin: string;
  artKey: string;
  shortHint: string;
  history: string;
  glocalizationLink: string;
  funFact: string;
  rewardJades: number;
}

export interface QuizChoice {
  label: string;
  correct: boolean;
}

export interface NpcEncounter {
  id: string;
  planetId: PlanetId;
  name: string;
  role: string;
  landmark: string;
  x: number;
  y: number;
  accentColor: string;
  greeting: string;
  riddleQuestion: string;
  options: string[];
  correctIndex: number;
  hintText: string;
  explanation: string;
  rewardRelicId: string;
  rewardJades: number;
}

export interface ChestEncounter {
  id: string;
  planetId: PlanetId;
  label: string;
  landmark: string;
  x: number;
  y: number;
  isSecret: boolean;
  requiresQuiz: boolean;
  quizQuestion?: string;
  options?: string[];
  correctIndex?: number;
  explanation?: string;
  rewardRelicId: string;
  rewardJades: number;
}

export interface PuzzlePair {
  id: string;
  label: string;
  artKey: string;
  correctMatch: string;
}

export interface PuzzleEncounter {
  id: string;
  planetId: PlanetId;
  title: string;
  landmark: string;
  x: number;
  y: number;
  prompt: string;
  pairs: PuzzlePair[];
  matchPool: string[];
  explanation: string;
  rewardRelicId: string;
  rewardJades: number;
}

export interface SpotEncounter {
  id: string;
  planetId: PlanetId;
  label: string;
  landmark: string;
  x: number;
  y: number;
  inspectText: string;
  isSecret: boolean;
  behindBuilding?: boolean;
  guardWispId?: string;
  requiresPlanetRelics?: number;
  guardianChallengeHeroId?: HeroId;
  challengeTitle?: string;
  challengeQuestion?: string;
  challengeOptions?: string[];
  challengeCorrect?: number;
  challengeHint?: string;
  challengeExplanation?: string;
  rewardRelicId: string;
  rewardJades: number;
}

export interface BossQuestion {
  q: string;
  options: string[];
  correct: number;
  exp: string;
}

export interface BossEncounter {
  id: string;
  planetId: PlanetId;
  name: string;
  title: string;
  landmark: string;
  x: number;
  y: number;
  accentColor: string;
  introLine: string;
  defeatLine: string;
  rewardRelicId: string;
  rewardJades: number;
  questions: BossQuestion[];
}

export interface SecretZone {
  id: string;
  planetId: PlanetId;
  x: number;
  y: number;
  width: number;
  height: number;
  coverTitle: string;
  revealHint: string;
  tint: string;
}

export interface WorldPlatform {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'stone' | 'wood' | 'holo' | 'crystal' | 'ruin';
  label?: string;
}

export interface WorldHazardOrObstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'crate' | 'pillar' | 'cactus_ruin' | 'holo_barrier';
}

export interface WorldMonsterSpawn {
  id: string;
  x: number;
  y: number;
  range: number;
  speed?: number;
  phase?: number;
  guardsSpotId?: string;
}

export interface WorldPortal {
  x: number;
  y: number;
  targetPlanetId: PlanetId | null;
  label: string;
}

export type PuzzleKind = 'matching' | 'classification' | 'sequence' | 'gate_code' | 'dilemma';

export type RelicTier = 'utama' | 'tersembunyi' | 'arsip';

export interface WorldMovingPlatform {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'stone' | 'wood' | 'holo' | 'crystal' | 'ruin';
  moveAxis: 'x' | 'y';
  range: number;
  speed: number;
  phaseOffset?: number;
  label?: string;
}

export interface WorldSwitch {
  id: string;
  x: number;
  y: number;
  targetGateId: string;
  label: string;
  hint?: string;
}

export interface WorldGate {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  mode: 'switch' | 'code' | 'mechanism';
  requiredSwitchId?: string;
  gateCode?: string;
  codeClueId?: string;
  codeOptions?: string[];
  hints?: [string, string, string];
  rewardJades: number;
  label: string;
  bridgeOnUnlock?: boolean;
}

export interface WorldSpNode {
  id: string;
  x: number;
  y: number;
  restoreAmount: number;
  label: string;
}

export interface WorldClueObject {
  id: string;
  x: number;
  y: number;
  title: string;
  category: 'clue' | 'archive' | 'cultural_note';
  body: string;
  revealedCode?: string;
  relatedGateId?: string;
  rewardJades: number;
}

export interface GuardianMechanism {
  id: string;
  x: number;
  y: number;
  heroId: HeroId;
  title: string;
  description: string;
  spCost: number;
  rewardJades: number;
  targetGateId?: string;
  altMethodNote: string;
}

export interface WorldActivitySpot {
  id: string;
  activityId: string;
  x: number;
  y: number;
  label: string;
}

export interface PlanetWorldLayout {
  planetId: PlanetId;
  spawnX: number;
  spawnY: number;
  groundY: number;
  worldWidth: number;
  worldHeight: number;
  platforms: WorldPlatform[];
  obstacles: WorldHazardOrObstacle[];
  monsterSpawns?: WorldMonsterSpawn[];
  secretZones: SecretZone[];
  landmarks: { x: number; name: string; kind: string }[];
  portal?: WorldPortal;
  movingPlatforms?: WorldMovingPlatform[];
  switches?: WorldSwitch[];
  gates?: WorldGate[];
  spNodes?: WorldSpNode[];
  clueObjects?: WorldClueObject[];
  mechanisms?: GuardianMechanism[];
  activitySpots?: WorldActivitySpot[];
}

export interface GuardianExplorePower {
  heroId: HeroId;
  skillName: string;
  shortDesc: string;
  passiveName: string;
  passiveDesc: string;
  accentColor: string;
  cooldownSec: number;
  durationSec: number;
  speedBonus: number;
  jumpBonus: number;
  bonusQuizJades: number;
  riddleHintCharges: number;
  bossShieldCharges: number;
}

export interface WorkshopIngredient {
  id: string;
  side: 'local' | 'global';
  name: string;
  origin: string;
  artKey: string;
  summary: string;
}

export interface WorkshopRecipe {
  id: string;
  localId: string;
  globalId: string;
  resultRelicId: string;
  resultName: string;
  tagline: string;
  explanation: string;
  question: string;
  options: string[];
  correctIndex: number;
  crystalReward: number;
  jadeReward: number;
}

export interface ExplorationActivityClassificationItem {
  id: string;
  text: string;
  group: string;
}

export interface ExplorationActivitySequenceStep {
  id: string;
  text: string;
  correctOrder: number;
}

export interface ExplorationActivityDilemmaChoice {
  id: string;
  label: string;
  outcomeTitle: string;
  outcomeBody: string;
  codexNote: string;
  rewardJades: number;
}

export interface ExplorationActivity {
  id: string;
  planetId: PlanetId;
  kind: 'classification' | 'sequence' | 'dilemma';
  title: string;
  subtitle: string;
  prompt: string;
  rewardJades: number;
  hints: [string, string, string];
  explanation: string;
  groups?: string[];
  items?: ExplorationActivityClassificationItem[];
  steps?: ExplorationActivitySequenceStep[];
  choices?: ExplorationActivityDilemmaChoice[];
}

export interface ExplorationSupplyItem {
  id: 'sp_elixir' | 'hint_lens' | 'astra_tonic';
  name: string;
  price: number;
  color: string;
  symbol: string;
  description: string;
}

export interface ExplorerAccessory {
  id: string;
  name: string;
  price: number;
  color: string;
  symbol: string;
  description: string;
}

export interface DiscoveryLogEntry {
  relicId: string;
  planetId: PlanetId;
  method: string;
  timestamp: string;
}

export interface ExplorationProgress {
  discoveredRelics: string[];
  discoveryLog: DiscoveryLogEntry[];
  openedChests: string[];
  solvedNpcs: string[];
  solvedPuzzles: string[];
  inspectedSpots: string[];
  defeatedBosses: string[];
  completedPlanets: PlanetId[];
  unlockedPlanets: PlanetId[];
  glocalCrystals: number;
  craftedRecipes: string[];
  ownedAccessories: string[];
  equippedAccessory: string;
  activePlanet: PlanetId;
  exploreSp?: number;
  maxExploreSp?: number;
  spPotions?: number;
  hintTokens?: number;
  activatedSwitches?: string[];
  unlockedGates?: string[];
  solvedActivities?: string[];
  dilemmaChoices?: Record<string, string>;
  readClues?: string[];
  visitedZones?: string[];
  activatedMechanisms?: string[];
}

export interface CodexStats {
  totalFound: number;
  totalRelics: number;
  completionPct: number;
  byCategory: Record<RelicCategory, { found: number; total: number }>;
  byPlanet: Record<PlanetId, { found: number; total: number }>;
}
