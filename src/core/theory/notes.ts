// Notes : lettre (0 = C … 6 = B) + altération (-2 … +2). L'orthographe compte en jazz :
// C°7 s'écrit C E♭ G♭ B𝄫, pas C D♯ F♯ A.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
export const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11] as const;
const ACC_SYMBOL: Record<number, string> = { [-2]: '𝄫', [-1]: '♭', 0: '', 1: '♯', 2: '𝄪' };

export interface Note {
  letter: number; // 0..6
  acc: number; // -2..2
}

export const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Écart signé le plus court entre deux classes de hauteur (-5..6). */
export const signedPc = (d: number) => {
  const m = mod(d, 12);
  return m > 6 ? m - 12 : m;
};

export const pcOf = (n: Note) => mod(NATURAL_PC[n.letter] + n.acc, 12);

export const noteName = (n: Note) => LETTERS[n.letter] + (ACC_SYMBOL[n.acc] ?? '?');

/** Orthographie la classe de hauteur `pc` avec la lettre `letter`. */
export function spellWith(letter: number, pc: number): Note {
  const l = mod(letter, 7);
  return { letter: l, acc: signedPc(pc - NATURAL_PC[l]) };
}

/** Lettres possibles pour une classe de hauteur (altération simple au plus). */
export const lettersFor = (pc: number) =>
  [0, 1, 2, 3, 4, 5, 6].filter((l) => Math.abs(signedPc(pc - NATURAL_PC[l])) <= 1);

/** Coût d'orthographe : double altération très pénalisée. */
export const spellCost = (notes: Note[]) =>
  notes.reduce((s, n) => s + (Math.abs(n.acc) >= 2 ? 4 : Math.abs(n.acc)), 0);

/** Parse « Bb », « B♭ », « F#», « F♯ », « Ebb »… Renvoie null si invalide. */
export function parseNote(s: string): { note: Note; rest: string } | null {
  const m = /^([A-Ga-g])((?:bb|♭♭|𝄫|##|♯♯|𝄪|b|♭|#|♯)?)/.exec(s);
  if (!m) return null;
  const letter = LETTERS.indexOf(m[1].toUpperCase() as (typeof LETTERS)[number]);
  const a = m[2];
  const acc = a === '' ? 0 : /^(bb|♭♭|𝄫)$/.test(a) ? -2 : /^(##|♯♯|𝄪)$/.test(a) ? 2 : /^(b|♭)$/.test(a) ? -1 : 1;
  return { note: { letter, acc }, rest: s.slice(m[0].length) };
}

/** Nom simple (bémols) pour une hauteur MIDI sans contexte. */
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const plainName = (midi: number) => FLAT_NAMES[mod(midi, 12)];
export const isBlackKey = (midi: number) => [1, 3, 6, 8, 10].includes(mod(midi, 12));
