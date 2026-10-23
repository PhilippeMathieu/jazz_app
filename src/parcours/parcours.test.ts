import { beforeEach, describe, expect, it } from 'vitest';
import { STEPS, activityById } from './steps';
import { Parcours, nextInStep, nextItem, pianoWaiting, stepState } from './progress';
import { RHYTHM_LEVELS, rhythmsOf } from '../core/rhythm/patterns';
import { TIPS } from '../modules/cours/tips';
import { LESSONS } from '../modules/cours/lessons';
import { offsetOf, saveOffset } from '../core/rhythm/offset';
import { chartById } from '../library/charts';
import { improvPlan } from '../core/analysis/improv';
import { storyOf } from '../core/analysis/story';
import { quizOf } from '../modules/grilles/Story';

// Stockage en mémoire (tests sous Node).
const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k)
};

const fresh = (start = 0): Parcours => ({ start, acts: {}, lessons: [], where: 'metro' });
const all = STEPS.flatMap((s) => s.activities);

describe('parcours : contenu', () => {
  it('des identifiants uniques', () => {
    expect(new Set(all.map((a) => a.id)).size).toBe(all.length);
    expect(activityById('r-tempo')?.step.id).toBe('notes');
  });
  it('des objectifs atteignables', () => {
    for (const a of all) if (a.goal.kind === 'answers') expect(a.goal.min).toBeLessThanOrEqual(a.goal.n);
  });
  it('des niveaux de rythme qui existent', () => {
    for (const a of all) {
      if (a.run.kind !== 'rythme') continue;
      if (a.run.exercise === 'tempo') expect(a.run.level).toBeLessThan(5);
      else if (a.run.exercise !== 'style') {
        expect(a.run.level).toBeLessThan(RHYTHM_LEVELS.length);
        expect(rhythmsOf(a.run.level).length).toBeGreaterThan(3);
      }
    }
  });
  it('chaque astuce d’enchaînement est dans une leçon du parcours, une seule fois', () => {
    const inParcours = new Set(STEPS.flatMap((s) => s.lessons));
    const used = LESSONS.filter((l) => inParcours.has(l.id)).flatMap((l) => l.blocks.flatMap((b) => (b.t === 'astuce' ? [b.id] : [])));
    expect(used.sort()).toEqual(TIPS.map((t) => t.id).sort());
  });
  it('étape 4 : à l’oreille, de 2 accords jusqu’aux 5 ensemble', () => {
    const sets = STEPS.find((s) => s.id === 'quatre')!.activities.filter((a) => !a.optional && a.run.kind === 'ear' && a.run.set).map((a) => (a.run.kind === 'ear' ? a.run.set!.length : 0));
    expect(sets[0]).toBe(2);
    expect(sets).toContain(3);
    expect(sets).toContain(4);
    expect(sets[sets.length - 1]).toBe(5);
  });
  it('les quiz de morceaux : au moins 3 phrases à reconnaître', () => {
    const quizzes = all.filter((a) => a.run.kind === 'chart' && a.run.mode === 'analyser');
    expect(quizzes.map((a) => (a.run.kind === 'chart' ? a.run.chart : ''))).toEqual(expect.arrayContaining(['let-it-be', 'wind-of-change']));
    for (const a of quizzes) {
      const c = chartById(a.run.kind === 'chart' ? a.run.chart : '')!;
      const p = improvPlan(c);
      expect(quizOf(storyOf(c, p.flat, p.analysis, p.scales), c.genre ?? 'jazz', 1).length, a.id).toBeGreaterThanOrEqual(3);
    }
  });
  it('du rythme à chaque étape', () => {
    for (const s of STEPS) expect(s.activities.some((a) => a.run.kind === 'rythme' && !a.optional)).toBe(true);
  });
});

describe('parcours : la suite', () => {
  it('commence par la première leçon', () => {
    const n = nextItem(fresh());
    expect(n).toEqual({ kind: 'lesson', step: STEPS[0], id: STEPS[0].lessons[0] });
  });
  it('dans le métro, saute les exercices au piano', () => {
    const s = STEPS[0];
    const p = fresh();
    p.lessons = [...s.lessons];
    for (const a of s.activities) if (a.where === 'metro') p.acts[a.id] = { best: 10, passed: true, at: 0 };
    const n = nextItem(p, 'metro');
    expect(n?.step).toBe(STEPS[1]);
    expect(pianoWaiting(p)).toBe(s.activities.filter((a) => a.where === 'piano' && !a.optional).length);
    const inStep = nextInStep(p, s, 'piano');
    expect(inStep?.kind === 'activity' && inStep.act.where).toBe('piano');
  });
  it('les étapes avant le point de départ sont acquises', () => {
    const p = fresh(3);
    expect(stepState(p, STEPS[2]).complete).toBe(true);
    expect(stepState(p, STEPS[3]).complete).toBe(false);
    expect(nextItem(p)?.step).toBe(STEPS[3]);
  });
});

describe('décalage', () => {
  beforeEach(() => mem.clear());
  it('pas encore mesuré', () => {
    expect(offsetOf('tap')).toBeUndefined();
  });
  it('reprend l’ancien réglage des exercices de rythme', () => {
    mem.set('hj:rythme', JSON.stringify({ offsets: { tap: 40, mic: 120 } }));
    expect(offsetOf('tap')).toBe(40);
    saveOffset('mic', 90);
    expect(offsetOf('mic')).toBe(90);
    expect(offsetOf('tap')).toBe(40);
  });
});
