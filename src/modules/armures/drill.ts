// Gammes et armures : de l'armure à la tonalité, de la tonalité à l'armure, et citer les altérations.
import { Rng, weightedPick } from '../../core/random';

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const SOLFEGE: Record<string, string> = { C: 'do', D: 'ré', E: 'mi', F: 'fa', G: 'sol', A: 'la', B: 'si' };
export const SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
export const FLATS = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

/** Une tonalité majeure et son armure : n > 0 dièses, n < 0 bémols. */
export interface KeySig {
  n: number;
  major: string;
  minor: string;
}
export const KEYS: KeySig[] = [
  { n: 0, major: 'C', minor: 'A' },
  { n: 1, major: 'G', minor: 'E' },
  { n: 2, major: 'D', minor: 'B' },
  { n: 3, major: 'A', minor: 'F♯' },
  { n: 4, major: 'E', minor: 'C♯' },
  { n: 5, major: 'B', minor: 'G♯' },
  { n: 6, major: 'F♯', minor: 'D♯' },
  { n: 7, major: 'C♯', minor: 'A♯' },
  { n: -1, major: 'F', minor: 'D' },
  { n: -2, major: 'B♭', minor: 'G' },
  { n: -3, major: 'E♭', minor: 'C' },
  { n: -4, major: 'A♭', minor: 'F' },
  { n: -5, major: 'D♭', minor: 'B♭' },
  { n: -6, major: 'G♭', minor: 'E♭' },
  { n: -7, major: 'C♭', minor: 'A♭' }
];
export const keyOf = (n: number) => KEYS.find((k) => k.n === n)!;

/** Les altérations de l'armure, dans l'ordre : 3 → F♯ C♯ G♯. */
export const accidentals = (n: number) => (n >= 0 ? SHARPS.slice(0, n).map((l) => l + '♯') : FLATS.slice(0, -n).map((l) => l + '♭'));
export const sigLabel = (n: number) => (n === 0 ? 'rien' : `${Math.abs(n)} ${n > 0 ? '♯' : '♭'}`);
/** « F♯ » → « fa♯ ». */
export const solf = (name: string) => SOLFEGE[name[0]] + name.slice(1);
export const keyText = (name: string, minor: boolean) => `${name} ${minor ? 'mineur' : 'majeur'}`;

export const LEVELS = [
  { name: 'Dièses 0–3', desc: 'C, G, D, A : l’armure ↔ la tonalité majeure' },
  { name: 'Dièses 0–7', desc: 'Jusqu’à C♯ majeur, 7 ♯' },
  { name: 'Bémols', desc: 'De F (1 ♭) à C♭ (7 ♭)' },
  { name: 'Tout + mineur', desc: 'Dièses et bémols mélangés, avec le relatif mineur' },
  { name: 'Citer', desc: 'Nommer les altérations dans l’ordre' }
];

export type Kind = 'sig2key' | 'key2sig' | 'names';
export interface Question {
  id: string;
  kind: Kind;
  key: KeySig;
  minor: boolean;
  /** sig2key et key2sig : les 4 réponses proposées (noms de tonalité ou nombres d'altérations). */
  choices: string[];
  answer: string;
}
export type Tally = Record<string, { c: number; t: number }>;

export function keysFor(level: number): KeySig[] {
  if (level === 0) return KEYS.filter((k) => k.n >= 0 && k.n <= 3);
  if (level === 1) return KEYS.filter((k) => k.n >= 0);
  if (level === 2) return KEYS.filter((k) => k.n <= 0);
  return KEYS;
}

const nameOf = (k: KeySig, minor: boolean) => (minor ? k.minor : k.major);

export function makeQuestion(level: number, tally: Tally, rng: Rng = Math.random, avoid?: string): Question {
  const keys = keysFor(level);
  const kinds: Kind[] = level === 4 ? ['names'] : ['sig2key', 'key2sig'];
  const pool: { key: KeySig; kind: Kind; minor: boolean; id: string }[] = [];
  for (const key of keys)
    for (const kind of kinds)
      for (const minor of level >= 3 ? [false, true] : [false]) {
        if (kind === 'names' && key.n === 0) continue;
        pool.push({ key, kind, minor, id: `${kind}:${key.n}:${minor ? 'm' : 'M'}` });
      }
  // Les erreurs reviennent plus souvent ; jamais deux fois la même question de suite.
  const items = pool.filter((p) => p.id !== avoid);
  const p = weightedPick(items, (x) => {
    const t = tally[x.id];
    return t ? 1 + 3 * (1 - t.c / t.t) + 1 / (1 + t.t) : 2;
  }, rng);
  const { key, kind, minor } = p;
  // Distracteurs : armures voisines, même sens d'abord.
  const near = keys
    .filter((k) => k.n !== key.n)
    .sort((a, b) => Math.abs(a.n - key.n) - Math.abs(b.n - key.n) + (rng() - 0.5) * 1.5)
    .slice(0, 3);
  let choices: string[] = [];
  let answer = '';
  if (kind === 'sig2key') {
    answer = nameOf(key, minor);
    choices = [answer, ...near.map((k) => nameOf(k, minor))];
  } else if (kind === 'key2sig') {
    answer = sigLabel(key.n);
    // En bémols comme en dièses, proposer aussi l'erreur classique : le bon nombre, le mauvais signe.
    const mirror = key.n !== 0 && keys.some((k) => k.n === -key.n) ? [sigLabel(-key.n)] : [];
    choices = [answer, ...mirror, ...near.map((k) => sigLabel(k.n))].filter((x, i, a) => a.indexOf(x) === i).slice(0, 4);
  } else {
    answer = accidentals(key.n).join(' ');
  }
  // Toujours dans l'ordre des armures, pour ne pas chercher.
  const order = (s: string) => (kind === 'key2sig' ? KEYS.findIndex((k) => sigLabel(k.n) === s) : KEYS.findIndex((k) => nameOf(k, minor) === s));
  if (kind !== 'names') choices = choices.sort((a, b) => order(a) - order(b));
  return { id: p.id, kind, key, minor, choices, answer };
}

/** L'explication, avec la règle qui permet de retrouver seul. */
export function explain(q: Question): string[] {
  const { key, minor } = q;
  const acc = accidentals(key.n);
  const out: string[] = [];
  const name = keyText(nameOf(key, minor), minor);
  out.push(`${name} : ${key.n === 0 ? 'rien à la clé' : `${sigLabel(key.n)} à la clé, ${acc.join(' ')} (${acc.map(solf).join(' ')})`}.`);
  if (key.n > 0) out.push(`Ordre des ♯ : fa do sol ré la mi si. Dernier ♯ (${acc[acc.length - 1]}) + ½ ton = ${key.major}, la tonique majeure.`);
  else if (key.n === -1) out.push('1 ♭ (si♭) : F majeur, à retenir par cœur.');
  else if (key.n < 0) out.push(`Ordre des ♭ : si mi la ré sol do fa. L’avant-dernier ♭ (${acc[acc.length - 2]}) est la tonique majeure.`);
  else out.push('Do majeur et la mineur : aucune altération.');
  if (minor) out.push(`Mineur : même armure que son relatif majeur, ${key.major}. La tonique mineure est 1 ton ½ plus bas (6e degré) : ${key.major} → ${key.minor}.`);
  return out;
}

/** Les touches de « Citer » : les 7 notes dans l'ordre de la gamme, en ♯ puis en ♭ (l'ordre est à trouver). */
export const NAME_ROWS = [LETTERS.map((l) => l + '♯'), LETTERS.map((l) => l + '♭')];

/** « Citer » : juste si toutes les altérations sont là, dans l'ordre. */
export const judgeNames = (q: Question, typed: string[]) => typed.join(' ') === q.answer;
