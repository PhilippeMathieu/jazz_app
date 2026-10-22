// Événements envoyés par les exercices (réponse, leçon lue, grille analysée…), temps de pratique du jour,
// objectif quotidien et série de jours. Le parcours s'abonne à ces événements pour valider les exercices.
import { load, save } from './storage';

export type AppEvent =
  /** Une réponse (juste / fausse), temps passé (ms), exercice et niveau. */
  | { type: 'answer'; exo: string; level: number; ok: boolean; ms: number; duel?: boolean }
  | { type: 'lesson'; id: string }
  | { type: 'analyse'; chart: string; found: number; total: number; bad: number }
  | { type: 'listen'; chart: string; mode: 'analyse' | 'guide' | 'gammes'; ratio: number; chords: number }
  | { type: 'memoire'; chart: string; level: number; ok: number; total: number };

const listeners = new Set<(ev: AppEvent) => void>();
/** S'abonner aux événements ; renvoie la fonction de désabonnement. */
export function onEvent(f: (ev: AppEvent) => void) {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
}

// ---------------------------------------------------------------- Jour, objectif, série

export interface Days {
  /** Objectif quotidien, en minutes de pratique. */
  goalMin: number;
  /** Temps de pratique par jour (clé AAAA-MM-JJ), en ms. */
  days: Record<string, number>;
}
const DEFAULT_DAYS: Days = { goalMin: 10, days: {} };
export const loadDays = (): Days => load('jours', DEFAULT_DAYS);

export const dayKey = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export function addDaysKey(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

/** Temps compté pour un événement : une réponse au plus 30 s, une leçon 3 min, une analyse 4 min. */
export function practiceMs(ev: AppEvent): number {
  if (ev.type === 'answer') return Math.min(30000, Math.max(0, ev.ms));
  if (ev.type === 'lesson') return 180000;
  if (ev.type === 'analyse') return 240000;
  if (ev.type === 'memoire') return ev.total * 4000;
  return 0;
}

/**
 * Jours d'affilée où l'objectif est atteint (aujourd'hui compte s'il est atteint ; sinon la série d'hier tient).
 * Un jour manqué par période de 7 jours n'interrompt pas la série.
 */
export function streakOf(d: Days, today = dayKey()): { days: number; todayDone: boolean } {
  const goal = d.goalMin * 60000;
  const done = (k: string) => (d.days[k] ?? 0) >= goal;
  const todayDone = done(today);
  let n = todayDone ? 1 : 0;
  let k = addDaysKey(today, -1);
  let lastJoker = -99;
  for (let i = 1; i < 3650; i++, k = addDaysKey(k, -1)) {
    if (done(k)) {
      n++;
      continue;
    }
    if (n > 0 && done(addDaysKey(k, -1)) && i - lastJoker >= 7) {
      lastJoker = i;
      continue;
    }
    break;
  }
  return { days: n, todayDone };
}

const goalListeners = new Set<() => void>();
/** Prévenu quand l'objectif du jour vient d'être atteint. */
export const onGoalReached = (f: () => void) => {
  goalListeners.add(f);
  return () => {
    goalListeners.delete(f);
  };
};

export function setGoal(min: number) {
  save('jours', { ...loadDays(), goalMin: min });
}

/** Envoie un événement : compte le temps de pratique, puis prévient les abonnés. */
export function report(ev: AppEvent) {
  const ms = practiceMs(ev);
  if (ms > 0) {
    const d = loadDays();
    const k = dayKey();
    const before = d.days[k] ?? 0;
    const after = before + ms;
    // On ne garde que les 400 derniers jours.
    const keys = Object.keys(d.days).sort();
    const days = Object.fromEntries(keys.slice(-400).map((x) => [x, d.days[x]]));
    days[k] = after;
    save('jours', { ...d, days });
    const goal = d.goalMin * 60000;
    if (before < goal && after >= goal) goalListeners.forEach((f) => f());
  }
  listeners.forEach((f) => f(ev));
}
