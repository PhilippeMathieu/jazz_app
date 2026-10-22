// Où en est l'élève : leçons lues, exercices validés, étape de départ, métro ou piano.
import { useEffect, useState } from 'preact/hooks';
import { load, save } from '../core/storage';
import { Activity, STEPS, Step, Where } from './steps';

export interface ActState {
  /** Meilleur résultat (bonnes réponses, ou pourcentage pour les morceaux). */
  best: number;
  passed: boolean;
  at: number;
  /** Validé sans micro, par l'élève lui-même. */
  self?: boolean;
}
export interface Parcours {
  /** Étape de départ choisie au premier lancement (-1 : pas encore choisi). Les étapes d'avant sont acquises. */
  start: number;
  acts: Record<string, ActState>;
  lessons: string[];
  where: Where;
}
const KEY = 'parcours';
const DEFAULT: Parcours = { start: -1, acts: {}, lessons: [], where: 'metro' };

const listeners = new Set<() => void>();
export const loadParcours = (): Parcours => load(KEY, DEFAULT);
function update(f: (p: Parcours) => Parcours) {
  save(KEY, f(loadParcours()));
  listeners.forEach((x) => x());
}

/** L'état du parcours, à jour à chaque changement. */
export function useParcours(): Parcours {
  const [p, setP] = useState(loadParcours);
  useEffect(() => {
    const f = () => setP(loadParcours());
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return p;
}

export const setStart = (start: number) => update((p) => ({ ...p, start }));
export const setWhere = (where: Where) => update((p) => ({ ...p, where }));
export const markLesson = (id: string) => update((p) => (p.lessons.includes(id) ? p : { ...p, lessons: [...p.lessons, id] }));
/** Enregistre un passage ; renvoie vrai si l'exercice vient d'être validé pour la première fois. */
export function recordActivity(id: string, best: number, passed: boolean, self = false): boolean {
  const before = loadParcours().acts[id];
  update((p) => {
    const old = p.acts[id];
    return {
      ...p,
      acts: { ...p.acts, [id]: { best: Math.max(best, old?.best ?? 0), passed: passed || !!old?.passed, at: Date.now(), self: old?.passed ? old.self : self || undefined } }
    };
  });
  return passed && !before?.passed;
}
export const resetParcours = () => update(() => DEFAULT);

// ---------------------------------------------------------------- État d'une étape

export interface StepState {
  index: number;
  lessonsLeft: string[];
  required: Activity[];
  left: Activity[];
  /** Tout est fait (ou l'étape est avant l'étape de départ). */
  complete: boolean;
  /** Acquise d'office (avant l'étape de départ), sans rien avoir fait. */
  assumed: boolean;
  done: number;
  total: number;
}

export function stepState(p: Parcours, step: Step): StepState {
  const index = STEPS.indexOf(step);
  const lessonsLeft = step.lessons.filter((l) => !p.lessons.includes(l));
  const required = step.activities.filter((a) => !a.optional);
  const left = required.filter((a) => !p.acts[a.id]?.passed);
  const total = step.lessons.length + required.length;
  const done = total - lessonsLeft.length - left.length;
  const assumed = index < p.start && !!(lessonsLeft.length || left.length);
  return { index, lessonsLeft, required, left, complete: assumed || (!lessonsLeft.length && !left.length), assumed, done, total };
}

/** La prochaine chose à faire. */
export type Next = { kind: 'lesson'; step: Step; id: string } | { kind: 'activity'; step: Step; act: Activity };

/**
 * Dans la première étape pas finie : les leçons d'abord, puis les exercices. Dans le métro, seulement ce qui se fait
 * sans piano (si l'étape n'a plus que du piano, on passe à la suivante) ; au piano, le piano d'abord.
 */
export function nextItem(p: Parcours, where: Where = p.where): Next | null {
  for (const step of STEPS) {
    const st = stepState(p, step);
    if (st.complete) continue;
    if (st.lessonsLeft.length) return { kind: 'lesson', step, id: st.lessonsLeft[0] };
    const order = where === 'piano' ? [...st.left.filter((a) => a.where === 'piano'), ...st.left.filter((a) => a.where === 'metro')] : st.left.filter((a) => a.where === 'metro');
    if (order.length) return { kind: 'activity', step, act: order[0] };
  }
  return null;
}

/** L'étape en cours : la première pas finie. */
export function currentStep(p: Parcours): Step {
  return STEPS.find((s) => !stepState(p, s).complete) ?? STEPS[STEPS.length - 1];
}

/** Exercices au piano laissés en route : dans les étapes avant celle de la prochaine chose à faire dans le métro. */
export function pianoWaiting(p: Parcours): number {
  const next = nextItem(p, 'metro');
  const upto = next ? STEPS.indexOf(next.step) : STEPS.length;
  return STEPS.slice(0, upto)
    .filter((s) => !stepState(p, s).assumed)
    .reduce((n, s) => n + stepState(p, s).left.filter((a) => a.where === 'piano').length, 0);
}

/** La prochaine chose à faire dans une étape donnée (leçons, puis exercices : ceux du lieu d'abord). */
export function nextInStep(p: Parcours, step: Step, where: Where = p.where): Next | null {
  const lesson = step.lessons.find((l) => !p.lessons.includes(l));
  if (lesson) return { kind: 'lesson', step, id: lesson };
  const left = step.activities.filter((a) => !a.optional && !p.acts[a.id]?.passed);
  const order = [...left.filter((a) => a.where === where), ...left.filter((a) => a.where !== where)];
  return order[0] ? { kind: 'activity', step, act: order[0] } : null;
}
