import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function loadGameFromIndexHtml() {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptMatches = [...html.matchAll(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi)];
  assert.ok(scriptMatches.length >= 1, 'Expected inline <script> inside index.html');
  const code = scriptMatches[scriptMatches.length - 1][1];

  const storageMap = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => (storageMap.has(k) ? storageMap.get(k)! : null),
    setItem: (k: string, v: string) => {
      storageMap.set(k, String(v));
    },
    removeItem: (k: string) => {
      storageMap.delete(k);
    },
  };

  const sandbox: Record<string, unknown> = {
    globalThis: undefined,
    localStorage: mockLocalStorage,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout,
  };
  sandbox.globalThis = sandbox;

  vm.runInNewContext(code, sandbox);
  return {
    game: sandbox.GlokalisasiGame as Record<string, any>,
    mockLocalStorage,
  };
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('curriculum completeness: 7 lessons (1,3,5 story 25 chunks; 2,4,6 exam 10 Qs; 7 boss 30 unique Qs)', () => {
  const { game } = loadGameFromIndexHtml();
  assert.equal(game.LESSONS.length, 7);

  for (const lesson of game.LESSONS) {
    assert.ok(Array.isArray(lesson.topics) && lesson.topics.length >= 3, `Lesson ${lesson.id} should have topic bullets`);
    assert.ok(lesson.description && lesson.description.length > 10, `Lesson ${lesson.id} should have description`);
  }

  assert.equal(game.LESSONS[0].type, 'story');
  assert.equal(game.LESSONS[1].type, 'exam');
  assert.equal(game.LESSONS[2].type, 'story');
  assert.equal(game.LESSONS[3].type, 'exam');
  assert.equal(game.LESSONS[4].type, 'story');
  assert.equal(game.LESSONS[5].type, 'exam');
  assert.equal(game.LESSONS[6].type, 'boss');

  assert.equal(game.STORY_LESSON_1.length, 25);
  assert.equal(game.STORY_LESSON_3.length, 25);
  assert.equal(game.STORY_LESSON_5.length, 25);
  assert.equal(game.GRAND_EXAM_QUESTIONS.length, 30);

  const latihanQuestionsSeen = new Set<string>();
  const expectedPhases = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3];

  for (const lessonId of [2, 4, 6]) {
    const practice = game.PRACTICE_SETS[lessonId];
    const battle = game.BATTLE_SETS[lessonId];
    assert.equal(practice.length, 0, `Lesson ${lessonId} should no longer split into legacy quiz PRACTICE_SETS`);
    assert.equal(battle.length, 10, `Lesson ${lessonId} must have exactly 10 Monster Battle waves`);

    battle.forEach((wave: any, idx: number) => {
      assert.equal(wave.phase, expectedPhases[idx], `Lesson ${lessonId} wave ${idx} should be phase ${expectedPhases[idx]}`);
      assert.ok(typeof wave.topic === 'string' && wave.topic.trim().length > 3, `Lesson ${lessonId} wave ${idx} needs topic`);
      assert.ok(typeof wave.enemyName === 'string' && wave.enemyName.trim().length > 3, `Lesson ${lessonId} wave ${idx} needs enemyName`);
      assert.ok(typeof wave.enemySprite === 'string' && wave.enemySprite.startsWith('/assets/aistudio/'), `Lesson ${lessonId} wave ${idx} needs monster asset`);
      assert.equal(wave.choices.length, 3, `Lesson ${lessonId} wave ${idx} must have 3 choices`);
      assert.equal(wave.choices.filter((c: any) => c.correct).length, 1, `Lesson ${lessonId} wave ${idx} must have 1 correct choice`);
      for (const c of wave.choices) {
        assert.ok(typeof c.reason === 'string' && c.reason.trim().length > 8, `Choice in Lesson ${lessonId} wave ${idx} needs explanation`);
      }
      const normQ = normalizeText(wave.question);
      assert.equal(latihanQuestionsSeen.has(normQ), false, `Duplicate Latihan question found: "${wave.question}"`);
      latihanQuestionsSeen.add(normQ);
    });
  }

  const getSignificantTokens = (q: string): Set<string> => {
    const stopWords = new Set(['yang', 'dalam', 'pada', 'untuk', 'dengan', 'adalah', 'dari', 'atau', 'sebagai', 'oleh', 'apa', 'mengapa', 'bagaimana', 'manakah', 'berikut', 'ini', 'di', 'ke', 'dan', 'tidak', 'jika', 'saat', 'ketika', 'paling', 'tepat', 'konsep', 'contoh', 'glokalisasi', 'globalisasi', 'lokalisasi', 'budaya', 'lokal', 'global']);
    return new Set(
      normalizeText(q)
        .split(' ')
        .filter((w) => w.length >= 4 && !stopWords.has(w))
    );
  };

  const bossQuestionsSeen = new Set<string>();
  const latihanTokenList = Array.from(latihanQuestionsSeen).map((q) => ({ q, tokens: getSignificantTokens(q) }));

  for (const bossQ of game.GRAND_EXAM_QUESTIONS) {
    assert.equal(bossQ.c.length, 3);
    assert.ok(bossQ.a >= 0 && bossQ.a < 3);
    assert.ok(bossQ.exp.length > 10);
    const normBossQ = normalizeText(bossQ.q);
    assert.equal(
      latihanQuestionsSeen.has(normBossQ),
      false,
      `Lesson 7 question must not duplicate Lessons 2/4/6: "${bossQ.q}"`
    );
    const bossTokens = getSignificantTokens(bossQ.q);
    for (const latItem of latihanTokenList) {
      let intersection = 0;
      for (const tok of bossTokens) {
        if (latItem.tokens.has(tok)) intersection += 1;
      }
      const union = bossTokens.size + latItem.tokens.size - intersection;
      const jaccard = union > 0 ? intersection / union : 0;
      assert.ok(
        jaccard < 0.72,
        `Latihan question "${latItem.q}" overlaps too closely with Boss Exam question "${normBossQ}" (jaccard=${jaccard.toFixed(2)})`
      );
    }
    assert.equal(
      bossQuestionsSeen.has(normBossQ),
      false,
      `Lesson 7 question must be unique: "${bossQ.q}"`
    );
    bossQuestionsSeen.add(normBossQ);
  }
});

test('persistence & chapter unlocking: loadProgress, saveProgress, and sequential unlocks', () => {
  const { game, mockLocalStorage } = loadGameFromIndexHtml();
  const initial = game.loadProgress(mockLocalStorage);
  assert.equal(initial.jades, 0);
  assert.equal(initial.unlockedLesson, 1);
  assert.equal(game.isLessonUnlocked(initial, 1), true);
  assert.equal(game.isLessonUnlocked(initial, 2), false);

  const afterL1 = game.completeLessonProgress(initial, 1, 150);
  game.saveProgress(afterL1, mockLocalStorage);
  const reloaded = game.loadProgress(mockLocalStorage);
  assert.equal(reloaded.jades, 150);
  assert.equal(reloaded.unlockedLesson, 2);
  assert.deepEqual(Array.from(reloaded.completedLessons), [1]);
  assert.equal(game.isLessonUnlocked(reloaded, 2), true);
  assert.equal(game.isLessonUnlocked(reloaded, 3), false);

  // Corrupted storage falls back cleanly
  mockLocalStorage.setItem('honkai_glokalisasi_odyssey_v1', '{bad-json');
  const recovered = game.loadProgress(mockLocalStorage);
  assert.equal(recovered.unlockedLesson, 1);
  assert.equal(recovered.jades, 0);
});

test('latihan 10-question battle engine: phases, difficulty tiers, non-terminating 0 HP strike, categories, and result summary', () => {
  const { game } = loadGameFromIndexHtml();

  // Phase mapping: 0..2 -> Phase 1, 3..6 -> Phase 2, 7..9 -> Phase 3
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => game.resolveLatihanPhase(i)),
    [1, 1, 1, 2, 2, 2, 2, 3, 3, 3]
  );

  // Difficulty config per Latihan
  assert.equal(game.getLatihanDifficultyConfig(2).tier, 'basic');
  assert.equal(game.getLatihanDifficultyConfig(4).tier, 'advanced');
  assert.equal(game.getLatihanDifficultyConfig(6).tier, 'expert');
  assert.ok(game.getLatihanDifficultyConfig(6).bgmSpeedMult < game.getLatihanDifficultyConfig(4).bgmSpeedMult);

  // evaluateLatihanStrike deals 10% monster HP on hit, +15 HP on 3-combo, and NEVER aborts early when Player HP reaches 0
  const hit = game.evaluateLatihanStrike(80, 100, 2, true);
  assert.equal(hit.hit, true);
  assert.equal(hit.damageDealt, 10);
  assert.equal(hit.nextEnemyHp, 90);
  assert.equal(hit.nextCombo, 3);
  assert.equal(hit.healAmount, 15);
  assert.equal(hit.nextPlayerHp, 95);
  assert.equal(hit.defeat, false);

  const zeroHpMiss = game.evaluateLatihanStrike(20, 40, 2, false);
  assert.equal(zeroHpMiss.hit, false);
  assert.equal(zeroHpMiss.damageTaken, 20);
  assert.equal(zeroHpMiss.nextPlayerHp, 0);
  assert.equal(zeroHpMiss.nextCombo, 0);
  assert.equal(zeroHpMiss.defeat, false, 'Player reaching 0 HP in Latihan must continue all 10 questions');

  // Nilai categories & clock formatting
  assert.equal(game.getNilaiKategori(100), 'Sangat Baik');
  assert.equal(game.getNilaiKategori(80), 'Baik');
  assert.equal(game.getNilaiKategori(70), 'Cukup');
  assert.equal(game.getNilaiKategori(60), 'Perlu Ditingkatkan');
  assert.equal(game.getNilaiKategori(50), 'Perlu Belajar Kembali');
  assert.equal(game.formatElapsedClock(125000), '02:05');

  // calculateLatihanResult: Victory requires finalPlayerHp > 0 AND score >= 60
  const sampleRecords = [
    { topic: 'Konsep Dasar', isCorrect: true },
    { topic: 'Konsep Dasar', isCorrect: true },
    { topic: 'Globalisasi', isCorrect: false },
    { topic: 'Lokalisasi', isCorrect: true },
    { topic: 'Karakteristik', isCorrect: true },
    { topic: 'Ciri Utama', isCorrect: true },
    { topic: 'Ciri Utama', isCorrect: true },
    { topic: 'Contoh Kuliner', isCorrect: true },
    { topic: 'Contoh Media', isCorrect: false },
    { topic: 'Sintesis', isCorrect: true },
  ];
  const winRes = game.calculateLatihanResult(sampleRecords, 60, 74000);
  assert.equal(winRes.correctCount, 8);
  assert.equal(winRes.wrongCount, 2);
  assert.equal(winRes.score, 80);
  assert.equal(winRes.accuracy, 80);
  assert.equal(winRes.victory, true);
  assert.equal(winRes.statusLabel, 'Menang');
  assert.equal(winRes.category, 'Baik');
  assert.equal(winRes.elapsedFormatted, '01:14');
  assert.equal(winRes.masteredTopics.includes('Konsep Dasar'), true);
  assert.deepEqual(Array.from(winRes.reviewTopics), ['Globalisasi', 'Contoh Media']);

  const zeroHpRes = game.calculateLatihanResult(sampleRecords, 0, 74000);
  assert.equal(zeroHpRes.victory, false, '0 final HP results in Kalah status even with 80% score');
  assert.equal(zeroHpRes.statusLabel, 'Kalah');
});

test('battle strike mechanics handle 5-wave & 30-wave depletion, 3-streak +15 heal, victory, and reachable defeat', () => {
  const { game } = loadGameFromIndexHtml();

  // Correct hit on wave 0 of 5
  const hit1 = game.evaluateBattleStrike(100, 100, 0, true, 5, 0);
  assert.equal(hit1.weakBreak, true);
  assert.equal(hit1.nextCombo, 1);
  assert.equal(hit1.nextEnemyHp, 80);
  assert.equal(hit1.victory, false);

  // 3-streak heal (+15 HP, capped at 100)
  const hit3 = game.evaluateBattleStrike(80, 60, 2, true, 5, 2);
  assert.equal(hit3.nextCombo, 3);
  assert.equal(hit3.healAmount, 15);
  assert.equal(hit3.nextPlayerHp, 95);

  // Final wave on 5-wave battle triggers victory
  const win5 = game.evaluateBattleStrike(95, 20, 4, true, 5, 4);
  assert.equal(win5.victory, true);
  assert.equal(win5.nextEnemyHp, 0);

  // 30-wave Grand Exam scales cleanly and reaches 0 on wave 29 (30th question)
  const mid30 = game.evaluateBattleStrike(100, 50, 14, true, 30, 14);
  assert.equal(mid30.nextEnemyHp, 50);
  assert.equal(mid30.victory, false);

  const win30 = game.evaluateBattleStrike(85, 3, 29, true, 30, 29);
  assert.equal(win30.victory, true);
  assert.equal(win30.nextEnemyHp, 0);

  // Wrong choice triggers counterattack and reachable defeat at 20 HP
  const counter = game.evaluateBattleStrike(40, 100, 4, false, 5, 0);
  assert.equal(counter.hit, false);
  assert.equal(counter.damageTaken, 20);
  assert.equal(counter.nextPlayerHp, 20);
  assert.equal(counter.nextCombo, 0);
  assert.equal(counter.defeat, false);

  const fatal = game.evaluateBattleStrike(20, 100, 0, false, 30, 0);
  assert.equal(fatal.nextPlayerHp, 0);
  assert.equal(fatal.defeat, true);
});

function countSentences(text: string): number {
  const cleaned = text
    .replace(/\b(dr|prof|no|dll|dsb|dst|rp)\./gi, '$1')
    .replace(/(\d)\.(\d)/g, '$1$2')
    .trim();
  const parts = cleaned
    .split(/[.!?]+(?:\s+|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length;
}

test('all 4 heroes (Sparxie, Sparkle, Sampo, Nihilux) appear in lessons 1, 3, 5 with valid emotions, concepts, and 4-6 sentences per dialogue', () => {
  const { game } = loadGameFromIndexHtml();
  const expectedHeroes = ['sparxie', 'sparkle', 'sampo', 'nihilux'];
  assert.deepEqual(Object.keys(game.HEROES).sort(), [...expectedHeroes].sort());

  // 3-tier progressive titles: Dasar (1), Menengah (3), Kompleks (5)
  assert.match(game.LESSONS[0].title, /Dasar/i);
  assert.match(game.LESSONS[2].title, /Menengah/i);
  assert.match(game.LESSONS[4].title, /Kompleks/i);

  for (const id of expectedHeroes) {
    const hero = game.HEROES[id];
    assert.ok(hero.portraitSrc, `${id} needs portraitSrc`);
    assert.ok(hero.portraitSrc.startsWith('/assets/aistudio/'), `${id} portraitSrc must use real /assets/aistudio/ image`);
    assert.ok(hero.winPortraitSrc.startsWith('/assets/aistudio/'), `${id} winPortraitSrc must use real /assets/aistudio/ image`);
    assert.ok(hero.losePortraitSrc.startsWith('/assets/aistudio/'), `${id} losePortraitSrc must use real /assets/aistudio/ image`);
    assert.notEqual(hero.winPortraitSrc, hero.losePortraitSrc, `${id} win and lose portraits should reflect different expressions`);
  }

  for (const [label, story] of [
    ['STORY_LESSON_1', game.STORY_LESSON_1],
    ['STORY_LESSON_3', game.STORY_LESSON_3],
    ['STORY_LESSON_5', game.STORY_LESSON_5],
  ] as const) {
    assert.equal(story.length, 25, `${label} must have exactly 25 chunks`);
    const speakers = new Set(story.map((c: any) => c.speaker));
    assert.equal(speakers.has('Sparxie'), true, `${label} must include Sparxie`);
    assert.equal(speakers.has('Sparkle'), true, `${label} must include Sparkle`);
    assert.equal(speakers.has('Sampo'), true, `${label} must include Sampo`);
    assert.equal(speakers.has('Nihilux'), true, `${label} must include Nihilux`);

    story.forEach((chunk: any, idx: number) => {
      const heroKey = String(chunk.speaker || '').toLowerCase();
      assert.ok(expectedHeroes.includes(heroKey), `${label}[${idx}] invalid speaker: ${chunk.speaker}`);
      assert.ok(
        Boolean(game.ASSETS[heroKey]?.[chunk.emotion]),
        `${label}[${idx}] invalid emotion "${chunk.emotion}" for ${chunk.speaker}`
      );
      assert.ok(
        typeof chunk.concept === 'string' && chunk.concept.trim().length > 10,
        `${label}[${idx}] missing concept`
      );
      const sentenceCount = countSentences(chunk.text);
      assert.ok(
        sentenceCount >= 4 && sentenceCount <= 6,
        `${label}[${idx}] expected 4-6 sentences, got ${sentenceCount}: "${chunk.text}"`
      );
    });
  }
});

test('audio preferences, 3-mood adaptive BGM, selectedHero persistence, anti-overlap SFX cooldown, skills, and quick mode routing', () => {
  const { game, mockLocalStorage } = loadGameFromIndexHtml();

  // Mode-adaptive audio moods: chill when learning/browsing, quiz when answering quizzes, battle when fighting
  assert.equal(game.resolveAudioMood('title'), 'chill');
  assert.equal(game.resolveAudioMood('map'), 'chill');
  assert.equal(game.resolveAudioMood('story'), 'chill');
  assert.equal(game.resolveAudioMood('practice'), 'quiz');
  assert.equal(game.resolveAudioMood('battle'), 'battle');

  const saved = game.saveProgress(
    { jades: 220, unlockedLesson: 4, completedLessons: [1, 2, 3], muted: false, bgmVolume: 0.5, sfxVolume: 0.9, selectedHero: 'nihilux' },
    mockLocalStorage
  );
  assert.equal(saved.selectedHero, 'nihilux');
  assert.equal(saved.bgmVolume, 0.5);
  assert.equal(saved.sfxVolume, 0.9);

  const loaded = game.loadProgress(mockLocalStorage);
  assert.equal(loaded.selectedHero, 'nihilux');
  assert.equal(game.normalizeProgress({ selectedHero: 'sampo', bgmVolume: 2, sfxVolume: -1 }).selectedHero, 'sampo');
  assert.equal(game.normalizeProgress({ selectedHero: 'sampo', bgmVolume: 2, sfxVolume: -1 }).bgmVolume, 1);
  assert.equal(game.normalizeProgress({ selectedHero: 'sampo', bgmVolume: 2, sfxVolume: -1 }).sfxVolume, 0);

  // Anti-overlap SFX throttling
  const map: Record<string, number> = {};
  assert.equal(game.shouldTriggerSfx('click', 1000, map), true);
  assert.equal(game.shouldTriggerSfx('click', 1020, map), false);
  assert.equal(game.shouldTriggerSfx('click', 1080, map), true);

  // Skill evaluation across heroes
  assert.equal(game.evaluateSkillAction('sparxie', 80, 1, [], []).ok, false);
  const sparxieSkill = game.evaluateSkillAction('sparxie', 80, 2, [
    { correct: true }, { correct: false }, { correct: false }
  ], []);
  assert.equal(sparxieSkill.ok, true);
  assert.equal(sparxieSkill.nextPlayerHp, 95);
  assert.equal(sparxieSkill.nextSp, 0);
  assert.equal(sparxieSkill.eliminateIdx, 1);

  const sampoSkill = game.evaluateSkillAction('sampo', 80, 3, [{ correct: false }, { correct: true }], []);
  assert.equal(sampoSkill.ok, true);
  assert.equal(sampoSkill.comboGain, 1);
  assert.equal(sampoSkill.eliminateIdx, 0);

  const sparkleSkill = game.evaluateSkillAction('sparkle', 95, 2, [{ correct: true }], []);
  assert.equal(sparkleSkill.autoWinWave, true);
  assert.equal(sparkleSkill.nextPlayerHp, 100);
  assert.equal(sparkleSkill.bonusJades, 15);

  const nihiluxSkill = game.evaluateSkillAction('nihilux', 70, 2, [{ correct: true }], []);
  assert.equal(nihiluxSkill.autoWinWave, true);
  assert.equal(nihiluxSkill.nextPlayerHp, 84);
  assert.equal(nihiluxSkill.bonusJades, 10);

  // Quick mode routing: Practice & Play both launch Latihan Monster Battle cleanly
  const toPlain = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
  assert.deepEqual(toPlain(game.resolveModeLaunch('learn', 1)), { view: 'story', lessonId: 1, freeMode: false });
  assert.deepEqual(toPlain(game.resolveModeLaunch('practice', 1)), { view: 'battle', lessonId: 2, freeMode: true });
  assert.deepEqual(toPlain(game.resolveModeLaunch('play', 1)), { view: 'battle', lessonId: 2, freeMode: true });
  assert.deepEqual(toPlain(game.resolveModeLaunch('play', 7)), { view: 'battle', lessonId: 7, freeMode: false });
});

test('randomized answer spreading: Grand Exam A/B/C balanced and Fisher-Yates shufflers preserve correctness', () => {
  const { game } = loadGameFromIndexHtml();

  // Check static distribution in GRAND_EXAM_QUESTIONS
  const counts = [0, 0, 0];
  for (const q of game.GRAND_EXAM_QUESTIONS) {
    counts[q.a] += 1;
  }
  assert.ok(counts[0] >= 8 && counts[1] >= 8 && counts[2] >= 8, `Expected balanced A/B/C answers in Grand Exam, got ${JSON.stringify(counts)}`);

  // Test practice question shuffler on a sample question structure
  const samplePractice = {
    question: 'Contoh soal uji acak?',
    options: ['A. Pilihan Pertama', 'B. Pilihan Kedua', 'C. Pilihan Ketiga'],
    correct: 0,
    celebrate: 'Penjelasan singkat'
  };
  const shuffledP = game.shufflePracticeQuestion(samplePractice, () => 0.15);
  assert.equal(shuffledP.options.length, 3);
  assert.ok(shuffledP.options[0].startsWith('A. '));
  assert.ok(shuffledP.options[1].startsWith('B. '));
  assert.ok(shuffledP.options[2].startsWith('C. '));
  const newCorrectText = shuffledP.options[shuffledP.correct].replace(/^[ABC]\.\s*/, '');
  assert.equal(newCorrectText, 'Pilihan Pertama');

  // Test battle choice shuffle preserves exact correct choice text
  const origWave = game.BATTLE_SETS[2][0];
  const origWaveCorrect = origWave.choices.find((c: any) => c.correct).label.replace(/^[ABC]\.\s*/, '');
  const shuffledB = game.shuffleBattleChoices(origWave.choices, () => 0.25);
  assert.equal(shuffledB.length, 3);
  assert.equal(shuffledB.filter((c: any) => c.correct).length, 1);
  assert.equal(shuffledB.find((c: any) => c.correct).label.replace(/^[ABC]\.\s*/, ''), origWaveCorrect);

  // Wave trophy popup triggers properly
  assert.equal(game.shouldShowWaveRewardModal(false, 0, 5), true);
  assert.equal(game.shouldShowWaveRewardModal(false, 3, 5), true);
  assert.equal(game.shouldShowWaveRewardModal(false, 4, 5), false);
  assert.equal(game.shouldShowWaveRewardModal(true, 0, 30), false);
  assert.equal(game.shouldShowWaveRewardModal(true, 9, 30), true);
  assert.equal(game.shouldShowWaveRewardModal(true, 19, 30), true);
  assert.equal(game.shouldShowWaveRewardModal(true, 29, 30), false);
});

test('Toko Astral attack effects: catalog, high Stellar Jade pricing, purchase, equip, and persistence', () => {
  const { game, mockLocalStorage } = loadGameFromIndexHtml();

  const prices = Object.fromEntries(game.ATTACK_EFFECTS.map((e: any) => [e.id, e.price]));
  assert.deepEqual(prices, {
    classic: 0,
    comet: 350,
    love: 550,
    keris: 850,
    supernova: 1300
  });

  // Default progress owns only classic and equips classic
  const base = game.createDefaultProgress();
  assert.deepEqual(Array.from(base.ownedEffects), ['classic']);
  assert.equal(base.equippedEffect, 'classic');

  // normalizeProgress strips unknown/unowned effects cleanly
  const sanitized = game.normalizeProgress({
    jades: 100,
    ownedEffects: ['unknown_fx', 'comet'],
    equippedEffect: 'supernova'
  });
  assert.deepEqual(Array.from(sanitized.ownedEffects), ['classic', 'comet']);
  assert.equal(sanitized.equippedEffect, 'classic');

  // Insufficient Jades (200 < 350) blocks purchase of Ledakan Komet
  const tooPoor = game.purchaseAttackEffect({ jades: 200, ownedEffects: ['classic'], equippedEffect: 'classic' }, 'comet');
  assert.equal(tooPoor.ok, false);
  assert.equal(tooPoor.progress.jades, 200);
  assert.deepEqual(Array.from(tooPoor.progress.ownedEffects), ['classic']);

  // Valid purchase of Ledakan Komet (350 Jades) deducts Jades and equips it
  const boughtComet = game.purchaseAttackEffect({ jades: 1000, ownedEffects: ['classic'], equippedEffect: 'classic' }, 'comet');
  assert.equal(boughtComet.ok, true);
  assert.equal(boughtComet.alreadyOwned, false);
  assert.equal(boughtComet.progress.jades, 650);
  assert.equal(boughtComet.progress.equippedEffect, 'comet');
  assert.equal(boughtComet.progress.ownedEffects.includes('comet'), true);

  // Buying Ledakan Cinta (550 Jades) leaves 100 Jades and switches equippedEffect to love
  const boughtLove = game.purchaseAttackEffect(boughtComet.progress, 'love');
  assert.equal(boughtLove.ok, true);
  assert.equal(boughtLove.progress.jades, 100);
  assert.equal(boughtLove.progress.equippedEffect, 'love');

  // Re-purchasing already-owned effect does not deduct Jades again
  const rebuyComet = game.purchaseAttackEffect(boughtLove.progress, 'comet');
  assert.equal(rebuyComet.ok, true);
  assert.equal(rebuyComet.alreadyOwned, true);
  assert.equal(rebuyComet.progress.jades, 100);
  assert.equal(rebuyComet.progress.equippedEffect, 'comet');

  // Cannot equip unowned effect, can equip owned effect, and persists across save/load
  const failEquip = game.equipAttackEffect(rebuyComet.progress, 'supernova');
  assert.equal(failEquip.ok, false);

  const okEquip = game.equipAttackEffect(rebuyComet.progress, 'love');
  assert.equal(okEquip.ok, true);
  game.saveProgress(okEquip.progress, mockLocalStorage);
  const reloaded = game.loadProgress(mockLocalStorage);
  assert.equal(reloaded.jades, 100);
  assert.equal(reloaded.equippedEffect, 'love');
  assert.deepEqual(Array.from(reloaded.ownedEffects).sort(), ['classic', 'comet', 'love']);
});

test('RPG Learn Mode character voices: distinct timbre & pitch ranges for Sampo, Nihilux, Sparxie, and Sparkle', () => {
  const { game } = loadGameFromIndexHtml();

  const sparxie = game.getCharacterVoiceProfile('Sparxie');
  const sparkle = game.getCharacterVoiceProfile('Sparkle');
  const sampo = game.getCharacterVoiceProfile('Sampo');
  const nihilux = game.getCharacterVoiceProfile('Nihilux');

  assert.equal(sparxie.styleLabel, 'Suara Imut');
  assert.equal(sparkle.styleLabel, 'Suara Elegan');
  assert.equal(sampo.styleLabel, 'Laki-laki Licik');
  assert.equal(nihilux.styleLabel, 'Perempuan Ceria');

  // Pitch hierarchy: Sampo (bariton laki-laki) < Sparkle (elegan alto-mezzo) < Nihilux (ceria soprano) < Sparxie (imut tinggi)
  assert.ok(sampo.baseHz < 200, `Sampo should be male baritone, got ${sampo.baseHz}`);
  assert.ok(sampo.baseHz < sparkle.baseHz);
  assert.ok(sparkle.baseHz < nihilux.baseHz);
  assert.ok(nihilux.baseHz < sparxie.baseHz);

  // Legato elegan (Sparkle paling santai/teratur) vs cepat imut/ceria
  assert.ok(sparkle.syllableMs > sampo.syllableMs);
  assert.ok(sparkle.syllableMs > nihilux.syllableMs);
  assert.ok(sparkle.syllableMs > sparxie.syllableMs);

  // Check generated cadence for each speaker
  for (const speaker of ['Sparxie', 'Sparkle', 'Sampo', 'Nihilux']) {
    const steps = game.buildDialogueVoiceCadence(speaker, 'Selamat datang di pembelajaran glokalisasi Nusantara!');
    assert.ok(steps.length >= 5 && steps.length <= 9, `${speaker} cadence should have 5-9 syllables`);
    for (let i = 1; i < steps.length; i += 1) {
      assert.ok(steps[i].delayMs > steps[i - 1].delayMs, `${speaker} delays must strictly increase`);
    }
  }

  // Sampo sneaky rising smirk inflection at phrase end
  const sampoCadence = game.buildDialogueVoiceCadence('Sampo', 'Kesepakatan bisnis lintas budaya selalu menguntungkan.');
  const lastSampoStep = sampoCadence[sampoCadence.length - 1];
  assert.ok(lastSampoStep.freqEnd > lastSampoStep.freqStart, 'Sampo final smirk inflection should bend upward');
});

test('map planet assets include all 4 reference cosmic planet artworks', () => {
  const { game } = loadGameFromIndexHtml();
  assert.ok(game.ASSETS?.planets);
  for (const key of ['archipelago', 'pastelRibbon', 'astralVortex', 'crimsonAbyss']) {
    assert.ok(
      typeof game.ASSETS.planets[key] === 'string' && game.ASSETS.planets[key].startsWith('/assets/aistudio/'),
      `Missing planet asset ${key}`
    );
  }
});

test('answer keys are de-patterned across Latihan 1-3 & Grand Exam, and shuffleBattleWaveSequence varies order without losing correctness', () => {
  const { game } = loadGameFromIndexHtml();

  const checkSequenceHealth = (indices: number[], label: string) => {
    const counts = [0, 0, 0];
    let maxRun = 1;
    let curRun = 1;
    let adjacentTripleRepeats = 0;
    for (let i = 0; i < indices.length; i += 1) {
      const idx = indices[i];
      counts[idx] += 1;
      if (i > 0) {
        if (indices[i] === indices[i - 1]) {
          curRun += 1;
          if (curRun > maxRun) maxRun = curRun;
        } else {
          curRun = 1;
        }
      }
      if (
        i >= 5 &&
        indices[i - 5] === indices[i - 2] &&
        indices[i - 4] === indices[i - 1] &&
        indices[i - 3] === indices[i]
      ) {
        adjacentTripleRepeats += 1;
      }
    }
    assert.ok(maxRun <= 3, `${label} must not repeat same correct slot >=4 times in a row (got ${maxRun}): ${JSON.stringify(indices)}`);
    assert.ok(counts[0] >= 2 && counts[1] >= 2 && counts[2] >= 2, `${label} must cover A/B/C meaningfully: ${JSON.stringify(counts)}`);
    assert.equal(adjacentTripleRepeats, 0, `${label} must not repeat consecutive 3-answer cycles (like acb-acb): ${JSON.stringify(indices)}`);
  };

  for (const lessonId of [2, 4, 6]) {
    const indices = game.BATTLE_SETS[lessonId].map((w: any) => w.choices.findIndex((c: any) => c.correct));
    checkSequenceHealth(indices, `BATTLE_SETS[${lessonId}]`);
  }

  const grandIndices = game.GRAND_EXAM_QUESTIONS.map((q: any) => q.a);
  checkSequenceHealth(grandIndices, 'GRAND_EXAM_QUESTIONS');

  // Runtime shuffleBattleWaveSequence preserves all questions & exact correct option text
  const origWaves = game.BATTLE_SETS[2];
  let seed = 13;
  const rngA = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  let seed2 = 7777;
  const rngB = () => {
    seed2 = (seed2 * 9301 + 49297) % 233280;
    return seed2 / 233280;
  };
  const shuffledA = game.shuffleBattleWaveSequence(origWaves, rngA);
  const shuffledB = game.shuffleBattleWaveSequence(origWaves, rngB);
  assert.equal(shuffledA.length, origWaves.length);
  for (let i = 0; i < origWaves.length; i += 1) {
    assert.equal(shuffledA[i].question, origWaves[i].question);
    const origCorrect = origWaves[i].choices.find((c: any) => c.correct).label.replace(/^[ABC]\.\s*/, '');
    const shufCorrect = shuffledA[i].choices.find((c: any) => c.correct).label.replace(/^[ABC]\.\s*/, '');
    assert.equal(shufCorrect, origCorrect);
  }
  const idxSeqA = shuffledA.map((w: any) => w.choices.findIndex((c: any) => c.correct));
  const idxSeqB = shuffledB.map((w: any) => w.choices.findIndex((c: any) => c.correct));
  assert.notDeepEqual(idxSeqA, idxSeqB, 'Different RNG seeds should produce varied runtime answer slot sequences');

  const html = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
  for (const sfxKey of ['relic_found', 'gate_unlock', 'sp_recover', 'puzzle_success', 'puzzle_fail']) {
    assert.ok(html.includes(sfxKey), `Expected procedural SFX key "${sfxKey}" in index.html`);
  }
});



