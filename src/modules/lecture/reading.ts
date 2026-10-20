// Lecture de notes : une note sur la portée (clé de sol ou de fa), la nommer, la toucher ou la jouer.
import { LETTERS, mod } from '../../core/theory/notes';
import { BOTTOM_STEP, Clef, Written, midiOf, stepOf, writtenName } from '../../core/theory/staff';
import { Rng, weightedPick } from '../../core/random';

export const SOLFEGE = ['do', 'ré', 'mi', 'fa', 'sol', 'la', 'si'];
export const CLEF_LABEL: Record<Clef, string> = { treble: 'Clé de sol', bass: 'Clé de fa' };

export const solfegeName = (w: Written) => SOLFEGE[w.letter] + (w.acc > 0 ? ' dièse' : w.acc < 0 ? ' bémol' : '');


export const LEVELS = [
  { desc: 'Débutant : clé de sol, dans la portée' },
  { desc: 'Clé de fa, dans la portée' },
  { desc: 'Les deux clés, avec lignes supplémentaires' },
  { desc: 'Les deux clés, avec dièses et bémols' }
];

/** Étendue par niveau, en rangs diatoniques (bornes incluses). */
function rangeOf(level: number, clef: Clef): [number, number] {
  const b = BOTTOM_STEP[clef];
  // dans la portée : une note sous la ligne du bas à une note au-dessus de la ligne du haut
  if (level <= 2) return [b - 1, b + 9];
  // deux lignes supplémentaires de chaque côté
  return [b - 4, b + 12];
}
export const clefsFor = (level: number): Clef[] => (level === 1 ? ['treble'] : level === 2 ? ['bass'] : ['treble', 'bass']);

export interface Question {
  id: string;
  clef: Clef;
  note: Written;
  midi: number;
}

export const itemId = (clef: Clef, w: Written) => `${clef === 'treble' ? 'G' : 'F'}:${writtenName(w)}`;

export type Tally = Record<string, { c: number; t: number }>;
/** Taux d'erreur lissé (jamais vue ≈ 25 %) → poids de 1 à 9. */
const weightOf = (tally: Tally, id: string) => {
  const it = tally[id] ?? { c: 0, t: 0 };
  return 1 + (8 * (it.t - it.c + 0.5)) / (it.t + 2);
};

/** Toutes les notes possibles d'un niveau. Au N4, environ 4 notes sur 10 portent une altération. */
export function itemsFor(level: number): { clef: Clef; note: Written }[] {
  const out: { clef: Clef; note: Written }[] = [];
  for (const clef of clefsFor(level)) {
    const [lo, hi] = rangeOf(level, clef);
    for (let s = lo; s <= hi; s++) {
      const base: Written = { letter: mod(s, 7), acc: 0, octave: Math.floor(s / 7) };
      out.push({ clef, note: base });
      if (level >= 4) {
        // pas de E♯, B♯, C♭, F♭ : on reste sur les noms usuels
        if (base.letter !== 2 && base.letter !== 6) out.push({ clef, note: { ...base, acc: 1 } });
        if (base.letter !== 0 && base.letter !== 3) out.push({ clef, note: { ...base, acc: -1 } });
      }
    }
  }
  return out;
}

export function makeQuestion(level: number, tally: Tally = {}, rng: Rng = Math.random, prev?: string): Question {
  const items = itemsFor(level)
    .map((x) => ({ ...x, id: itemId(x.clef, x.note) }))
    .filter((x) => x.id !== prev);
  const x = weightedPick(items, (it) => weightOf(tally, it.id) * (level >= 4 && it.note.acc === 0 ? 0.6 : 1), rng);
  return { id: x.id, clef: x.clef, note: x.note, midi: midiOf(x.note) };
}

/** Réponse par le nom : la lettre et l'altération écrites (G♭ n'est pas F♯ quand on lit). */
export const nameIsRight = (q: Question, letter: number, acc: number) => q.note.letter === letter && q.note.acc === acc;
/** Réponse au clavier : la bonne touche, quelle que soit l'octave. */
export const keyIsRight = (q: Question, midi: number) => mod(midi, 12) === mod(q.midi, 12);

/** Au piano : bonne note à l'octave près, ou bonne note à la mauvaise octave. */
export function playedVerdict(q: Question, midi: number): 'ok' | 'octave' | 'wrong' {
  if (midi === q.midi) return 'ok';
  return mod(midi - q.midi, 12) === 0 ? 'octave' : 'wrong';
}

export const LETTER_CHOICES = LETTERS.map((l, i) => ({ letter: i, name: l, solfege: SOLFEGE[i] }));

const nth = (n: number, fem = true) => (n === 1 ? (fem ? '1re' : '1er') : `${n}e`);
const REF: Record<Clef, string> = {
  treble: 'lignes mi sol si ré fa, interlignes fa la do mi',
  bass: 'lignes sol si ré fa la, interlignes la do mi sol'
};

/** Où se trouve la note, en mots : « 4e ligne », « 2e interligne », « 1re ligne supplémentaire en dessous »… */
export function positionOf(clef: Clef, w: Written): string {
  const s = stepOf(w) - BOTTOM_STEP[clef];
  if (s >= 0 && s <= 8) return s % 2 === 0 ? `${nth(s / 2 + 1)} ligne` : `${nth((s + 1) / 2, false)} interligne`;
  const below = s < 0;
  const k = below ? -s : s - 8;
  const side = below ? 'en dessous' : 'au-dessus';
  if (k === 1) return below ? 'juste sous la portée' : 'juste au-dessus de la portée';
  if (k % 2 === 0) return `${nth(k / 2)} ligne supplémentaire ${side}`;
  return `${below ? 'sous' : 'au-dessus de'} la ${nth((k - 1) / 2)} ligne supplémentaire`;
}

/** Explication affichée après chaque réponse. */
export function explainNote(clef: Clef, w: Written): string {
  const name = `${writtenName(w)} (${solfegeName(w)})`;
  const acc = w.acc > 0 ? ' Le dièse monte la note d’un demi-ton.' : w.acc < 0 ? ' Le bémol la descend d’un demi-ton.' : '';
  const central = midiOf(w) === 60 && w.acc === 0 ? ', le do central' : '';
  return `${name}${central} : ${positionOf(clef, w)}. ${CLEF_LABEL[clef]} : ${REF[clef]}.${acc}`;
}
