import test from 'node:test';
import assert from 'node:assert/strict';

import { ALL_HERO_ANIM_STATES } from '../exploration/characterArt';
import {
  BOSS_ENCOUNTERS,
  CHEST_ENCOUNTERS,
  EXPLORATION_ACTIVITIES,
  EXPLORATION_SUPPLIES,
  EXPLORER_ACCESSORIES,
  NPC_ENCOUNTERS,
  PLANETS,
  PUZZLE_ENCOUNTERS,
  RELICS,
  SPOT_ENCOUNTERS,
  WORKSHOP_RECIPES,
  getGraduatedHintsForEncounter,
} from '../exploration/data';
import {
  activateGuardianMechanism,
  activateWorldSwitch,
  canChallengePlanetBoss,
  checkFullPlanetCollectionBonus,
  claimFullPlanetBonus,
  completePlanetBoss,
  consumeExploreSp,
  createDefaultExplorationProgress,
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
} from '../exploration/logic';
import { getRpgCharacterProfile, RPG_CHARACTER_PROFILES } from '../exploration/portraits';
import { renderLockedRelicSvg, renderRelicSvg } from '../exploration/relicArt';
import { PLANET_WORLD_LAYOUTS, getPlanetLayout } from '../exploration/worldMap';

function createMockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (idx: number) => Array.from(map.keys())[idx] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
  };
}

test('exploration dataset: 4 planets, 60 total relics (15 per map) all reachable with unique SVG art and exact names', () => {
  assert.equal(PLANETS.length, 4);
  assert.equal(RELICS.length, 60);

  const byCat = {
    local: RELICS.filter((r) => r.category === 'local'),
    global: RELICS.filter((r) => r.category === 'global'),
    glocal: RELICS.filter((r) => r.category === 'glocal'),
    lost: RELICS.filter((r) => r.category === 'lost'),
  };
  assert.equal(byCat.local.length, 15);
  assert.equal(byCat.global.length, 15);
  assert.equal(byCat.glocal.length, 15);
  assert.equal(byCat.lost.length, 15);

  // Verify exact 15 item names per planet
  const expectedNames: Record<string, string[]> = {
    terra_nusantara: [
      'Kain Batik',
      'Angklung',
      'Wayang Kulit',
      'Kain Tenun Ikat',
      'Kain Ulos',
      'Kain Songket',
      'Tas Noken',
      'Alat Musik Sasando',
      'Alat Musik Kolintang',
      'Alat Musik Tifa',
      'Keris',
      'Topeng Cirebon',
      'Ukiran Jepara',
      'Congklak',
      'Miniatur Rumah Gadang',
    ],
    nova_metropolis: [
      'Smartphone',
      'Laptop',
      'Kamera Digital',
      'Headphone',
      'Piringan Musik Digital',
      'Sepatu Sneakers',
      'Jaket Streetwear',
      'Robot Asisten',
      'Jam Pintar',
      'Kartu Transportasi Digital',
      'Buku Digital',
      'Konsol Permainan',
      'Kamera Instan',
      'Satelit Komunikasi',
      'Hologram Media',
    ],
    fusion_kingdom: [
      'Jaket Streetwear Bermotif Batik',
      'Sneakers dengan Motif Tenun Ikat',
      'Angklung Elektronik',
      'Pertunjukan Wayang Digital',
      'Kemasan Modern Jamu Tradisional',
      'Burger dengan Isian Rendang',
      'Pizza dengan Topping Bumbu Rendang',
      'Tas Modern Bermotif Noken',
      'Gaun Modern Bermotif Songket',
      'Kolintang dengan Teknologi Digital',
      'Animasi Cerita Rakyat Nusantara',
      'Komik Digital Legenda Indonesia',
      'Festival Musik Tradisional dan Modern',
      'Merchandise Modern Bermotif Nusantara',
      'Aplikasi Pembelajaran Bahasa Daerah',
    ],
    lost_civilization: [
      'Naskah Lontar',
      'Catatan Cerita Rakyat Nusantara',
      'Rekaman Bahasa Daerah',
      'Catatan Tradisi Lisan',
      'Arsip Tari Tradisional',
      'Catatan Musik Daerah',
      'Peta Rumah Adat Nusantara',
      'Catatan Teknik Tenun Tradisional',
      'Resep Masakan Tradisional',
      'Arsip Permainan Tradisional',
      'Catatan Upacara Adat',
      'Dokumentasi Seni Ukir',
      'Catatan Filosofi Batik',
      'Arsip Legenda Daerah',
      'Kristal Identitas Budaya',
    ],
  };

  for (const [planetId, names] of Object.entries(expectedNames)) {
    const planetRelics = RELICS.filter((r) => r.planetId === planetId);
    assert.equal(planetRelics.length, 15, `${planetId} must have exactly 15 collectibles`);
    const actualNames = new Set(planetRelics.map((r) => r.name));
    for (const expectedName of names) {
      assert.ok(actualNames.has(expectedName), `Missing "${expectedName}" in ${planetId}`);
    }
  }

  // All 15 Fusion Kingdom collectibles must be clearly marked as conceptual creations in game
  for (const r of byCat.glocal) {
    assert.equal(r.isConceptualCreation, true, `Fusion Kingdom item ${r.id} must set isConceptualCreation: true`);
  }

  // Every rarity tier and diverse discovery methods are represented
  const rarities = new Set(RELICS.map((r) => r.rarity));
  assert.deepEqual(new Set(['common', 'rare', 'epic', 'legendary']), rarities);
  const methods = new Set(RELICS.map((r) => r.discoveryMethod));
  for (const requiredMethod of [
    'npc',
    'chest',
    'puzzle',
    'platform',
    'behind_building',
    'secret_passage',
    'monster_guard',
    'gated_area',
    'guardian_challenge',
    'boss',
  ] as const) {
    assert.ok(methods.has(requiredMethod), `Discovery method ${requiredMethod} must be present`);
  }

  // Every relic is reachable in-world (1:1 encounter mapping) and produces UNIQUE SVG artwork
  const worldReachableRelics = new Set<string>();
  NPC_ENCOUNTERS.forEach((e) => worldReachableRelics.add(e.rewardRelicId));
  CHEST_ENCOUNTERS.forEach((e) => worldReachableRelics.add(e.rewardRelicId));
  PUZZLE_ENCOUNTERS.forEach((e) => worldReachableRelics.add(e.rewardRelicId));
  SPOT_ENCOUNTERS.forEach((e) => worldReachableRelics.add(e.rewardRelicId));
  Object.values(BOSS_ENCOUNTERS).forEach((b) => worldReachableRelics.add(b.rewardRelicId));

  const renderedSvgBodies = new Set<string>();
  for (const relic of RELICS) {
    assert.ok(worldReachableRelics.has(relic.id), `Relic ${relic.id} must be discoverable inside its 2D planet map`);
    assert.ok(relic.history.length > 20, `Relic ${relic.id} should include cultural history`);
    assert.ok(relic.glocalizationLink.length > 20, `Relic ${relic.id} should link to glocalization`);
    const svg = renderRelicSvg(relic.artKey, relic.category, 80);
    assert.ok(svg.includes('<svg') && svg.includes('</svg>'), `Relic ${relic.id} needs valid SVG artwork`);
    // Strip the outer category-colored rect/defs frame to verify the inner artwork path itself is unique per relic
    const innerArt = svg.slice(svg.indexOf('</defs>'));
    assert.ok(!renderedSvgBodies.has(innerArt), `Relic ${relic.id} (${relic.artKey}) must have bespoke unique SVG art`);
    renderedSvgBodies.add(innerArt);

    const lockedSvg = renderLockedRelicSvg(relic.category, relic.artKey);
    assert.ok(lockedSvg.includes('<svg') && lockedSvg.includes('?'));
  }

  assert.ok(WORKSHOP_RECIPES.length >= 6);
});

test('world layouts: all 4 planets have valid 3800px bounds, stepped platforms, secret zones, and monster guard spawns', () => {
  for (const planet of PLANETS) {
    const layout = PLANET_WORLD_LAYOUTS[planet.id];
    assert.ok(layout, `Layout missing for ${planet.id}`);
    assert.equal(layout.worldWidth, 3800);
    assert.ok(layout.platforms.length >= 10);
    assert.ok(layout.secretZones.length >= 2);
    assert.ok((layout.monsterSpawns?.length ?? 0) >= 3);
    assert.ok(layout.spawnX >= 0 && layout.spawnX < layout.worldWidth);

    for (const plat of layout.platforms) {
      assert.ok(plat.x >= 0 && plat.x + plat.w <= layout.worldWidth, `Platform out of world bounds in ${planet.id}`);
      assert.ok(plat.y < layout.groundY && layout.groundY - plat.y <= 320, `Platform height unreasonable in ${planet.id}`);
    }

    assert.ok(layout.portal, `Portal missing for ${planet.id}`);
    assert.ok(layout.portal.x > 0 && layout.portal.x < layout.worldWidth, `Portal out of world bounds in ${planet.id}`);
  }

  // Monster-guarded spots & Guardian challenge spots exist cleanly
  const guardedSpots = SPOT_ENCOUNTERS.filter((s) => Boolean(s.guardWispId));
  assert.equal(guardedSpots.length, 4);
  for (const gs of guardedSpots) {
    const spawns = PLANET_WORLD_LAYOUTS[gs.planetId].monsterSpawns || [];
    assert.ok(spawns.some((m) => m.id === gs.guardWispId), `Missing Void guard spawn ${gs.guardWispId}`);
  }

  const guardianSpots = SPOT_ENCOUNTERS.filter((s) => Boolean(s.guardianChallengeHeroId));
  assert.equal(guardianSpots.length, 4);
});

test('spot access gating enforces Void guard defeat and planet relic thresholds cleanly', () => {
  let prog = createDefaultExplorationProgress();
  const tifaSpot = SPOT_ENCOUNTERS.find((s) => s.id === 'spot_terra_tifa')!;
  const ulosSpot = SPOT_ENCOUNTERS.find((s) => s.id === 'spot_terra_ulos')!;

  const blockedByWisp = evaluateSpotAccess(tifaSpot, prog, []);
  assert.equal(blockedByWisp.accessible, false);
  assert.equal(blockedByWisp.reason, 'guarded');

  const clearedWisp = evaluateSpotAccess(tifaSpot, prog, ['terra_guard_tifa']);
  assert.equal(clearedWisp.accessible, true);

  const gatedBlocked = evaluateSpotAccess(ulosSpot, prog, []);
  assert.equal(gatedBlocked.accessible, false);
  assert.equal(gatedBlocked.reason, 'gated');
  assert.equal(gatedBlocked.requiredRelics, 6);

  const terraRelics = RELICS.filter((r) => r.planetId === 'terra_nusantara');
  for (let i = 0; i < 6; i += 1) {
    prog = unlockRelicInProgress(prog, terraRelics[i].id, 'Test').progress;
  }
  const gatedOpen = evaluateSpotAccess(ulosSpot, prog, []);
  assert.equal(gatedOpen.accessible, true);
});

test('codex stats auto-update across all 60 relics and persist across localStorage save/load', () => {
  const store = createMockStorage();
  let prog = createDefaultExplorationProgress();
  assert.equal(getCodexStats(prog).totalFound, 0);
  assert.equal(getCodexStats(prog).totalRelics, 60);

  const res1 = unlockRelicInProgress(prog, 'local_batik', 'Teka-teki Mbah Ratna', '10:15');
  assert.equal(res1.newlyDiscovered, true);
  prog = res1.progress;

  // Duplicate unlock does not double-count
  const dup = unlockRelicInProgress(prog, 'local_batik', 'Ulangi', '10:16');
  assert.equal(dup.newlyDiscovered, false);

  const res2 = unlockRelicInProgress(prog, 'global_holo_phone', 'Kota Futuristik', '10:20');
  prog = res2.progress;

  const stats = getCodexStats(prog);
  assert.equal(stats.totalFound, 2);
  assert.equal(stats.totalRelics, 60);
  assert.equal(stats.byCategory.local.found, 1);
  assert.equal(stats.byCategory.local.total, 15);
  assert.equal(stats.byCategory.global.found, 1);
  assert.equal(stats.byCategory.global.total, 15);
  assert.equal(stats.byCategory.glocal.total, 15);
  assert.equal(stats.byCategory.lost.total, 15);
  assert.equal(stats.byPlanet.terra_nusantara.found, 1);
  assert.equal(stats.byPlanet.terra_nusantara.total, 15);
  assert.equal(prog.discoveryLog.length, 2);

  saveExplorationProgress(prog, store);
  const reloaded = loadExplorationProgress(store);
  assert.deepEqual(reloaded.discoveredRelics, prog.discoveredRelics);
  assert.equal(reloaded.discoveryLog[0].relicId, 'global_holo_phone');

  // Verify discoveryLog keeps all 60 items without truncating at 60
  let fullProg = createDefaultExplorationProgress();
  for (const relic of RELICS) {
    fullProg = unlockRelicInProgress(fullProg, relic.id, 'Full Sweep', '12:00').progress;
  }
  const savedFull = saveExplorationProgress(fullProg, store);
  assert.equal(savedFull.discoveredRelics.length, 60);
  assert.equal(savedFull.discoveryLog.length, 60);
});

test('guardian exploration powers differentiate sparxie, sparkle, sampo, and nihilux', () => {
  const sparxie = getGuardianPower('sparxie');
  const sparkle = getGuardianPower('sparkle');
  const sampo = getGuardianPower('sampo');
  const nihilux = getGuardianPower('nihilux');

  assert.ok(sparxie.jumpBonus > 1.1, 'Sparxie should jump higher');
  assert.ok(sparkle.bonusQuizJades > 0, 'Sparkle should award bonus Jades on quizzes');
  assert.ok(sampo.speedBonus >= 1.2 && sampo.riddleHintCharges >= 1, 'Sampo boosts speed and grants free hint');
  assert.ok(nihilux.bossShieldCharges >= 1, 'Nihilux grants boss mistake shield');
});

test('boss gate, sequential planet unlocking, and full 15/15 planet completion bonus', () => {
  let prog = createDefaultExplorationProgress();
  const initialGate = canChallengePlanetBoss(prog, 'terra_nusantara');
  assert.equal(initialGate.allowed, false);
  assert.equal(initialGate.requiredCount, 10);

  const terraRelics = RELICS.filter((r) => r.planetId === 'terra_nusantara');
  for (let i = 0; i < 10; i += 1) {
    prog = unlockRelicInProgress(prog, terraRelics[i].id, 'Test').progress;
  }

  const readyGate = canChallengePlanetBoss(prog, 'terra_nusantara');
  assert.equal(readyGate.allowed, true);

  const bossWin = completePlanetBoss(prog, 'terra_nusantara');
  prog = bossWin.progress;
  assert.equal(bossWin.newlyDefeated, true);
  assert.equal(bossWin.unlockedNextPlanet, 'nova_metropolis');
  assert.ok(prog.unlockedPlanets.includes('nova_metropolis'));

  // Boss defeat alone must NOT mark the planet 100% complete or block the full bonus
  const prematureBonus = claimFullPlanetBonus(prog, 'terra_nusantara');
  assert.equal(prematureBonus.awarded, false);
  assert.equal(prematureBonus.bonusJades, 0);

  // Unlock all 15 Terra Nusantara relics -> eligible for full collection bonus once
  for (const r of terraRelics) {
    prog = unlockRelicInProgress(prog, r.id, 'Full').progress;
  }
  const full = checkFullPlanetCollectionBonus(prog, 'terra_nusantara');
  assert.equal(full.eligible, true);
  assert.equal(full.found, 15);
  assert.equal(full.total, 15);

  const claimed = claimFullPlanetBonus(prog, 'terra_nusantara');
  assert.equal(claimed.awarded, true);
  assert.equal(claimed.bonusJades, 75);
  assert.ok(claimed.progress.completedPlanets.includes('terra_nusantara'));

  const doubleClaim = claimFullPlanetBonus(claimed.progress, 'terra_nusantara');
  assert.equal(doubleClaim.awarded, false);
  assert.equal(doubleClaim.bonusJades, 0);
});

test('glocalization workshop rejects mismatched pairs constructively and rewards glocal crystals on valid synthesis + quiz', () => {
  const bad = evaluateWorkshopCombination('ing_local_batik', 'ing_global_sneakers');
  assert.equal(bad.valid, false);
  assert.equal(bad.recipe, null);
  assert.ok(bad.feedback.includes('belum membentuk adaptasi glokalisasi'));

  const good = evaluateWorkshopCombination('ing_local_batik', 'ing_global_streetwear');
  assert.equal(good.valid, true);
  assert.ok(good.recipe);
  assert.equal(good.recipe.resultName, 'Jaket Streetwear Bermotif Batik');

  let prog = createDefaultExplorationProgress();
  const wrongIdx = (good.recipe.correctIndex + 1) % 3;
  const wrongQuiz = evaluateWorkshopQuiz(prog, good.recipe, wrongIdx);
  assert.equal(wrongQuiz.isCorrect, false);
  assert.equal(wrongQuiz.crystalGained, 0);

  const rightQuiz = evaluateWorkshopQuiz(prog, good.recipe, good.recipe.correctIndex);
  assert.equal(rightQuiz.isCorrect, true);
  assert.equal(rightQuiz.crystalGained, 1);
  assert.equal(rightQuiz.jadeGained, 20);
  prog = rightQuiz.progress;
  assert.equal(prog.glocalCrystals, 1);
  assert.ok(prog.discoveredRelics.includes('glocal_batik_streetwear'));
});

test('shuffleOptionsKeepAnswer preserves correct option text and explorer accessories validate jades', () => {
  const opts = ['Jawaban Benar', 'Pengecoh 1', 'Pengecoh 2'];
  const shuffled = shuffleOptionsKeepAnswer(opts, 0, () => 0.15);
  assert.equal(shuffled.options.length, 3);
  assert.equal(shuffled.options[shuffled.correctIndex], 'Jawaban Benar');

  let prog = createDefaultExplorationProgress();
  const paidAcc = EXPLORER_ACCESSORIES.find((a) => a.price > 0)!;
  const tooPoor = purchaseExplorerAccessory(prog, 20, paidAcc.id);
  assert.equal(tooPoor.ok, false);

  const bought = purchaseExplorerAccessory(prog, 500, paidAcc.id);
  assert.equal(bought.ok, true);
  assert.equal(bought.cost, paidAcc.price);
  assert.equal(bought.progress.equippedAccessory, paidAcc.id);
  prog = bought.progress;

  // Equipping already owned accessory costs 0
  const reEquip = purchaseExplorerAccessory(prog, 0, 'none');
  assert.equal(reEquip.ok, true);
  assert.equal(reEquip.cost, 0);
});

test('all 8 core RPG character animation states and 4 HSR-style Guardian profiles are defined cleanly', () => {
  const expectedStates = ['idle', 'walk', 'run', 'jump', 'attack', 'hurt', 'interact', 'artifact'];
  assert.deepEqual([...ALL_HERO_ANIM_STATES], expectedStates);

  const ids = ['sparkle', 'sparxie', 'sampo', 'nihilux'] as const;
  const roleBadges = new Set<string>();
  const portraits = new Set<string>();
  for (const id of ids) {
    const prof = RPG_CHARACTER_PROFILES[id];
    assert.ok(prof, `Missing profile for ${id}`);
    assert.ok(prof.portraitUrl.startsWith('/src/assets/images/'), `Portrait URL must point to generated src/assets asset: ${prof.portraitUrl}`);
    assert.ok(prof.portraitUrl.endsWith('.jpg'));
    assert.ok(prof.roleBadge.length > 5);
    assert.ok(prof.personality.length > 10);
    assert.ok(prof.companionName.length > 3);
    assert.equal(getRpgCharacterProfile(id).id, id);
    roleBadges.add(prof.roleBadge);
    portraits.add(prof.portraitUrl);
  }
  assert.equal(roleBadges.size, 4, 'Each Guardian must have a distinct role badge');
  assert.equal(portraits.size, 4, 'Each Guardian must have a unique generated portrait');
});

test('world expansion: every planet has moving platforms, switches, clue-linked code gates, SP nodes, mechanisms, and 3 diverse activities', () => {
  assert.equal(EXPLORATION_ACTIVITIES.length, 12);
  assert.equal(EXPLORATION_SUPPLIES.length, 3);

  for (const planet of PLANETS) {
    const layout = getPlanetLayout(planet.id);
    assert.ok((layout.movingPlatforms?.length ?? 0) >= 2, `${planet.id} needs >=2 movingPlatforms`);
    assert.ok((layout.switches?.length ?? 0) >= 1, `${planet.id} needs >=1 switch`);
    assert.ok((layout.gates?.length ?? 0) >= 2, `${planet.id} needs >=2 gates`);
    assert.ok((layout.spNodes?.length ?? 0) >= 3, `${planet.id} needs >=3 SP crystal nodes`);
    assert.ok((layout.clueObjects?.length ?? 0) >= 3, `${planet.id} needs >=3 clueObjects`);
    assert.ok((layout.mechanisms?.length ?? 0) >= 2, `${planet.id} needs >=2 guardian mechanisms`);
    assert.equal(layout.activitySpots?.length ?? 0, 3, `${planet.id} needs 3 activitySpots`);

    // Every code gate has a matching clue object revealing the exact gateCode (never unhinted guessing)
    const codeGates = (layout.gates || []).filter((g) => g.mode === 'code');
    assert.ok(codeGates.length >= 1, `${planet.id} needs at least 1 code gate`);
    for (const cg of codeGates) {
      const clue = (layout.clueObjects || []).find((c) => c.id === cg.codeClueId);
      assert.ok(clue, `Code gate ${cg.id} must link to an existing clueObject ${cg.codeClueId}`);
      assert.equal(clue.revealedCode, cg.gateCode, `Clue ${clue.id} must reveal exact gateCode for ${cg.id}`);
    }

    // Activities per planet cover classification, sequence, and dilemma
    const planetActs = EXPLORATION_ACTIVITIES.filter((a) => a.planetId === planet.id);
    assert.equal(planetActs.length, 3);
    assert.deepEqual(
      new Set(planetActs.map((a) => a.kind)),
      new Set(['classification', 'sequence', 'dilemma'])
    );
    for (const spot of layout.activitySpots || []) {
      assert.ok(planetActs.some((a) => a.id === spot.activityId), `ActivitySpot ${spot.id} references unknown activity`);
    }
  }
});

test('SP economy, Toko Perbekalan Eksplorasi, and Relic Tiers work with zero soft-lock guarantees', () => {
  let prog = createDefaultExplorationProgress();
  assert.equal(prog.exploreSp, 100);
  assert.equal(prog.spPotions, 2);
  assert.equal(prog.hintTokens, 2);

  // Consume SP and fail cleanly when SP insufficient
  const spent = consumeExploreSp(prog, 90);
  assert.equal(spent.ok, true);
  assert.equal(spent.sp, 10);
  prog = spent.progress;

  const blocked = consumeExploreSp(prog, 15);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.sp, 10);

  // Use SP potion to recover without soft-lock
  const potRes = useSpPotion(prog);
  assert.equal(potRes.ok, true);
  assert.equal(potRes.gained, 50);
  assert.equal(potRes.progress.exploreSp, 60);
  assert.equal(potRes.progress.spPotions, 1);
  prog = potRes.progress;

  // Recover via world SP crystal node
  const crystalRes = recoverExploreSp(prog, 60);
  assert.equal(crystalRes.sp, 100);
  assert.equal(crystalRes.gained, 40);
  prog = crystalRes.progress;

  // Purchase supplies in Toko Perbekalan Eksplorasi
  const tooPoor = purchaseExplorationSupply(prog, 10, 'sp_elixir');
  assert.equal(tooPoor.ok, false);

  const boughtPotion = purchaseExplorationSupply(prog, 200, 'sp_elixir');
  assert.equal(boughtPotion.ok, true);
  assert.equal(boughtPotion.cost, 40);
  assert.equal(boughtPotion.progress.spPotions, 2);

  const boughtLens = purchaseExplorationSupply(boughtPotion.progress, 160, 'hint_lens');
  assert.equal(boughtLens.ok, true);
  assert.equal(boughtLens.progress.hintTokens, 4);

  const boughtTonic = purchaseExplorationSupply(boughtLens.progress, 125, 'astra_tonic');
  assert.equal(boughtTonic.ok, true);
  assert.equal(boughtTonic.hpBonus, 25);
  assert.equal(boughtTonic.progress.exploreSp, 100);
  assert.equal(boughtTonic.progress.hintTokens, 5);

  // Relic tiers classify all 60 relics cleanly
  const tiers = new Set(RELICS.map((r) => getRelicTier(r)));
  assert.deepEqual(tiers, new Set(['utama', 'tersembunyi', 'arsip']));
});

test('5 puzzle types, 3-stage graduated hints, switches, gates, mechanisms, clues, and Zone Map tracking', () => {
  // Classification
  const classAct = EXPLORATION_ACTIVITIES.find((a) => a.kind === 'classification')!;
  const badMap: Record<string, string> = {};
  const goodMap: Record<string, string> = {};
  for (const item of classAct.items!) {
    badMap[item.id] = 'Salah';
    goodMap[item.id] = item.group;
  }
  assert.equal(evaluateClassificationPuzzle(classAct, badMap).valid, false);
  assert.equal(evaluateClassificationPuzzle(classAct, goodMap).valid, true);

  // Sequence
  const seqAct = EXPLORATION_ACTIVITIES.find((a) => a.kind === 'sequence')!;
  const orderedIds = [...seqAct.steps!].sort((a, b) => a.correctOrder - b.correctOrder).map((s) => s.id);
  assert.equal(evaluateSequencePuzzle(seqAct, [...orderedIds].reverse()).valid, false);
  assert.equal(evaluateSequencePuzzle(seqAct, orderedIds).valid, true);

  // Gate code
  const terraLayout = getPlanetLayout('terra_nusantara');
  const codeGate = terraLayout.gates!.find((g) => g.mode === 'code')!;
  assert.equal(evaluateGateCodePuzzle(codeGate, '999').valid, false);
  assert.equal(evaluateGateCodePuzzle(codeGate, codeGate.gateCode!).valid, true);

  // Dilemma & Graduated hints
  const dilAct = EXPLORATION_ACTIVITIES.find((a) => a.kind === 'dilemma')!;
  let prog = createDefaultExplorationProgress();
  const dilRes = recordDilemmaChoice(prog, dilAct.id, dilAct.choices![0].id);
  assert.equal(dilRes.firstTime, true);
  prog = dilRes.progress;
  assert.equal(recordDilemmaChoice(prog, dilAct.id, dilAct.choices![1].id).firstTime, false);

  const hints = getGraduatedHintsForEncounter('npc_mbah_ratna');
  assert.equal(getGraduatedHintStage(hints, 0).stage, 1);
  assert.equal(getGraduatedHintStage(hints, 0).hasNext, true);
  assert.equal(getGraduatedHintStage(hints, 2).stage, 3);
  assert.equal(getGraduatedHintStage(hints, 2).hasNext, false);

  // Switch, Gate, Clue, Mechanism, Zone Map
  const swRes = activateWorldSwitch(prog, 'sw_terra_1', 'gate_terra_bridge');
  assert.equal(swRes.newlyActivated, true);
  prog = swRes.progress;
  assert.ok(prog.activatedSwitches!.includes('sw_terra_1'));
  assert.ok(prog.unlockedGates!.includes('gate_terra_bridge'));

  const gRes = unlockWorldGate(prog, codeGate.id);
  assert.equal(gRes.newlyUnlocked, true);
  prog = gRes.progress;

  const cRes = markClueRead(prog, 'clue_terra_2');
  assert.equal(cRes.firstRead, true);
  prog = cRes.progress;

  const mRes = activateGuardianMechanism(prog, terraLayout.mechanisms![0].id, terraLayout.mechanisms![0].targetGateId);
  assert.equal(mRes.newlyActivated, true);
  prog = mRes.progress;

  const zRes = markVisitedZone(prog, `terra_nusantara:${terraLayout.landmarks[0].name}`);
  assert.equal(zRes.newlyVisited, true);
  prog = zRes.progress;

  const summary = getPlanetZoneMapSummary('terra_nusantara', prog, terraLayout);
  assert.equal(summary.length, terraLayout.landmarks.length);
  assert.equal(summary[0].visited, true);
});



