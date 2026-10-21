import { describe, expect, it } from 'vitest';
import { GameState, apply, gradeOf, makeChallenges, starsFor, streakOf } from './game';

const fresh = (): GameState => ({
  xp: 0,
  days: {},
  goalMin: 10,
  recent: {},
  stars: {},
  unlocked: {},
  badges: {},
  challenges: { date: '', list: [], bonus: false },
  standards: {},
  streaks: {},
  fx: false
});
const T = '2026-10-20';

describe('jeu', () => {
  it('étoiles sur 20 réponses, et le niveau suivant s’ouvre', () => {
    const g = fresh();
    let rewards: string[] = [];
    for (let i = 0; i < 20; i++) rewards = rewards.concat(apply(g, { type: 'answer', exo: 'tonalite', level: 0, ok: i % 10 !== 0, ms: 2000 }, T).map((r) => r.kind));
    expect(g.stars['tonalite:0']).toBe(3); // 18/20 = 90 %
    expect(g.unlocked.tonalite).toBe(1);
    expect(rewards).toContain('star');
    expect(rewards).toContain('unlock');
    expect(starsFor(0.59)).toBe(0);
    expect(starsFor(0.6)).toBe(1);
    expect(starsFor(0.75)).toBe(2);
    expect(starsFor(0.89)).toBe(2);
    expect(starsFor(1)).toBe(3);
  });
  it('objectif du jour : temps actif plafonné à 30 s par réponse', () => {
    const g = fresh();
    g.goalMin = 1;
    const r1 = apply(g, { type: 'answer', exo: 'oreille-ear', level: 1, ok: true, ms: 50000 }, T);
    expect(r1.some((r) => r.kind === 'goal')).toBe(false);
    const r2 = apply(g, { type: 'answer', exo: 'oreille-ear', level: 1, ok: true, ms: 40000 }, T);
    expect(r2.some((r) => r.kind === 'goal')).toBe(true);
  });
  it('série : un jour manqué par semaine est pardonné', () => {
    const g = fresh();
    const goal = { xp: 0, ms: 11 * 60000 };
    for (const d of ['2026-10-14', '2026-10-15', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']) g.days[d] = goal;
    const s = streakOf(g, T);
    expect(s.days).toBe(6);
    expect(s.jokerUsed).toBe(true);
    // Deux jours manqués dans la même semaine (16 et 18) : le joker couvre le 18, la série s'arrête au 16.
    delete g.days['2026-10-18'];
    expect(streakOf(g, T).days).toBe(3);
  });
  it('défis : progression et bonus', () => {
    const g = fresh();
    g.challenges = { date: T, list: makeChallenges(T, { weakExo: { exo: 'express', name: 'Enchaînements', href: '#/express' } }), bonus: false };
    for (let i = 0; i < 20; i++) apply(g, { type: 'answer', exo: 'express', level: 0, ok: true, ms: 1000 }, T);
    expect(g.challenges.list[0].done).toBe(20);
    const before = g.xp;
    apply(g, { type: 'tempo', level: 1, ratio: 0.95 }, T);
    apply(g, { type: 'analyse', chart: 'autumn-leaves', found: 10, total: 10, bad: 0 }, T);
    expect(g.challenges.bonus).toBe(true);
    expect(g.xp - before).toBeGreaterThanOrEqual(60 * 2 + 100);
    expect(g.badges.analyste).toBeTruthy();
  });
  it('grades et standards', () => {
    expect(gradeOf(0).name).toBe('Auditeur');
    expect(gradeOf(5000).name).toBe('Sideman');
    const g = fresh();
    apply(g, { type: 'analyse', chart: 'blues-f', found: 5, total: 5, bad: 0 }, T);
    apply(g, { type: 'listen', chart: 'blues-f', mode: 'guide', ratio: 0.85, chords: 16 }, T);
    apply(g, { type: 'listen', chart: 'blues-f', mode: 'analyse', ratio: 0.95, chords: 16 }, T);
    expect(g.badges.standard).toBeTruthy();
  });
  it('défi « Analyser [standard] » : seule cette grille compte', () => {
    const g = fresh();
    const analyse = { id: 'analyse', text: 'Analyser Tune Up', kind: 'analyse' as const, goal: 1, done: 0, href: '#/grille/tune-up/analyser' };
    g.challenges = { date: T, list: [analyse], bonus: false };
    apply(g, { type: 'analyse', chart: 'autumn-leaves', found: 3, total: 10, bad: 0 }, T);
    expect(g.challenges.list[0].done).toBe(0);
    apply(g, { type: 'analyse', chart: 'tune-up', found: 3, total: 10, bad: 0 }, T);
    expect(g.challenges.list[0].done).toBe(1);
    // « Analyser un morceau » : n'importe laquelle.
    const g2 = fresh();
    g2.challenges = { date: T, list: [{ ...analyse, text: 'Analyser un morceau', href: '#/grilles' }], bonus: false };
    apply(g2, { type: 'analyse', chart: 'autumn-leaves', found: 1, total: 10, bad: 0 }, T);
    expect(g2.challenges.list[0].done).toBe(1);
  });
});
