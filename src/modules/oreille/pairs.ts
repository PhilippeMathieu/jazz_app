// Comparer deux natures d'accord de 4 sons, deux à deux : quelle note change, de combien, et comment l'entendre.
// La chaîne maj7 → 7 → m7 → ø7 → °7 : chaque accord s'obtient du précédent en baissant une seule note d'un demi-ton.
import { Chord, QUALITIES, chordNotes } from '../../core/theory/chords';
import { Note, noteName, pcOf, mod } from '../../core/theory/notes';

export type Role = '3ce' | '5te' | '7e';
export interface Change {
  role: Role;
  from: Note;
  to: Note;
  /** Demi-tons (négatif : la note descend). */
  semis: number;
}

const ROLES: Role[] = ['3ce', '5te', '7e'];

/** Ce qui change de l'accord a à l'accord b, sur la même fondamentale (accords de 4 sons). */
export function changes(root: Note, a: string, b: string): Change[] {
  const A = chordNotes({ root, quality: a });
  const B = chordNotes({ root, quality: b });
  const ia = QUALITIES[a].iv;
  const ib = QUALITIES[b].iv;
  const out: Change[] = [];
  for (let i = 1; i <= 3; i++) if (ia[i] !== ib[i]) out.push({ role: ROLES[i - 1], from: A[i], to: B[i], semis: ib[i] - ia[i] });
  return out;
}

/** « la 7e : B → B♭ (un demi-ton plus bas) ». */
export function changeText(c: Change): string {
  const n = Math.abs(c.semis);
  const by = n === 1 ? 'un demi-ton' : n === 2 ? 'un ton' : `${n} demi-tons`;
  return `la ${c.role} : ${noteName(c.from)} → ${noteName(c.to)} (${by} plus ${c.semis < 0 ? 'bas' : 'haut'})`;
}

/** Les paires travaillées, dans l'ordre : une seule note change, sauf maj7 / m7 (deux). */
export const PAIRS: [string, string][] = [
  ['maj7', '7'],
  ['7', 'm7'],
  ['maj7', 'm7'],
  ['m7', 'm7b5'],
  ['m7b5', 'dim7']
];

const key = (a: string, b: string) => [a, b].sort().join('|');
const CUES: Record<string, string> = {
  [key('maj7', '7')]:
    'Écoute la note du haut. Dans maj7, la 7e est un demi-ton sous l’octave : elle frotte, son lumineux, au repos. Dans 7, elle est un ton sous l’octave et forme un triton avec la 3ce : ça tire, ça veut aller ailleurs.',
  [key('7', 'm7')]:
    'Même 7e : seule la 3ce change. 7 est clair et tendu ; m7 est plus sombre, plus doux, sans urgence. Pense « majeur ou mineur ? » comme pour les accords de 3 sons.',
  [key('maj7', 'm7')]:
    'Deux notes changent : la 3ce et la 7e. maj7 est clair et brillant ; m7 est doux et feutré. Le plus facile des trois : commence par la 3ce, clair ou sombre.',
  [key('m7', 'm7b5')]:
    'Même 3ce, même 7e : seule la 5te baisse. m7 reste posé ; ø7 sonne instable, inquiet, comme s’il manquait le sol sous les pieds.',
  [key('m7b5', 'dim7')]:
    'Seule la 7e baisse encore. ø7 garde une 7e « normale » ; °7 empile des tierces mineures toutes pareilles : symétrique, très tendu, le son des films muets.'
};
/** Comment entendre la différence entre deux natures. */
export const pairCue = (a: string, b: string) => CUES[key(a, b)] ?? '';

/** Nom court d'une nature (comme sur les boutons). */
export const qualName = (q: string) => QUALITIES[q].sym || 'majeur';

/** Classes de hauteur qui changent (pour les marquer au clavier). */
export const changedPcs = (root: Note, a: string, b: string) => changes(root, a, b).map((c) => [mod(pcOf(c.from), 12), mod(pcOf(c.to), 12)] as const);

export const chordOf = (root: Note, quality: string): Chord => ({ root, quality });
