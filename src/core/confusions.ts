// Confusions : ce que l'élève prend pour autre chose (m7 ↔ m7♭5, bossa ↔ samba…).
// Chaque erreur renforce la paire ; chaque bonne réponse où l'autre était proposé l'affaiblit.
// Une paire est « à travailler » tant qu'il y a plus d'erreurs que la moitié des bonnes réponses.
import { load, save } from './storage';

export type Domain = 'accord' | 'prog' | 'rythme' | 'style' | 'degre' | 'intervalle' | 'basse';
interface PairStat {
  err: number;
  ok: number;
}
type Store = Partial<Record<Domain, Record<string, PairStat>>>;

const KEY = 'confusions';
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export interface Pair {
  a: string;
  b: string;
  err: number;
  ok: number;
  /** Poids : erreurs moins la moitié des réussites. */
  score: number;
}

/** Enregistre une réponse. options : ce qui était proposé (pour compter les réussites face à un rival). */
export function recordAnswer(domain: Domain, truth: string, answer: string, options: string[], store: Store = load<Store>(KEY, {})): Store {
  const d = { ...(store[domain] ?? {}) };
  if (answer !== truth) {
    const k = pairKey(truth, answer);
    const p = d[k] ?? { err: 0, ok: 0 };
    d[k] = { ...p, err: p.err + 1 };
  } else {
    for (const o of options) {
      if (o === truth) continue;
      const k = pairKey(truth, o);
      if (!d[k]) continue;
      const before = active(d[k]);
      d[k] = { ...d[k], ok: d[k].ok + 1 };
      if (before && !active(d[k])) onGone.forEach((f) => f());
    }
  }
  const next = { ...store, [domain]: d };
  save(KEY, next);
  return next;
}

const active = (p: PairStat) => p.err >= 2 && p.err - p.ok / 2 > 0;
const onGone = new Set<() => void>();
/** Prévenu quand une paire confondue est vaincue (pour le badge). */
export const onConfusionGone = (f: () => void) => {
  onGone.add(f);
  return () => onGone.delete(f);
};

/** Paires à travailler, de la plus confondue à la moins. */
export function confusions(domain: Domain, store: Store = load<Store>(KEY, {})): Pair[] {
  return Object.entries(store[domain] ?? {})
    .map(([k, p]) => {
      const [a, b] = k.split('|');
      return { a, b, err: p.err, ok: p.ok, score: p.err - p.ok / 2 };
    })
    .filter((p) => active(p))
    .sort((x, y) => y.score - x.score);
}

/** Les rivaux d'un élément (avec qui il est confondu), du plus au moins confondu. */
export const rivalsOf = (pairs: Pair[], k: string) => pairs.filter((p) => p.a === k || p.b === k).map((p) => (p.a === k ? p.b : p.a));

/** Poids d'un élément dans le tirage : plus il est confondu, plus il revient. */
export const confusionWeight = (pairs: Pair[], k: string) => 1 + pairs.filter((p) => p.a === k || p.b === k).reduce((s, p) => s + Math.min(3, p.score), 0) / 2;

/** Efface les confusions d'un domaine. */
export function clearConfusions(domain: Domain) {
  const s = load<Store>(KEY, {});
  delete s[domain];
  save(KEY, s);
}
