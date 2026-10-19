// Gammes utilisées en improvisation jazz, avec l'orthographe de chaque degré.
import { Note, mod, noteName, spellWith } from './notes';

export interface ScaleDef {
  id: string;
  name: string;
  /** Intervalles depuis la fondamentale. */
  iv: number[];
  /** Écart de lettre de chaque degré (pour l'orthographe). */
  letters: number[];
  /** Nom court pour la grille. */
  short: string;
}

const S = (id: string, name: string, iv: number[], letters = [0, 1, 2, 3, 4, 5, 6]): ScaleDef => ({ id, name, iv, letters, short: SHORT[id] ?? name });
const SHORT: Record<string, string> = {
  ionien: 'ionien', dorien: 'dorien', phrygien: 'phrygien', lydien: 'lydien', mixolydien: 'mixo', eolien: 'éolien',
  locrien: 'locrien', locrien9: 'locr. ♮2', melodique: 'mél.', lydienb7: 'lyd. ♭7', mixob9b13: 'mixo ♭9♭13',
  alteree: 'altérée', dimHW: 'dim. ½–1', dimWH: 'dim. 1–½', tons: 'par tons', blues: 'blues'
};

export const SCALES: Record<string, ScaleDef> = Object.fromEntries(
  [
    S('ionien', 'ionien (majeur)', [0, 2, 4, 5, 7, 9, 11]),
    S('dorien', 'dorien', [0, 2, 3, 5, 7, 9, 10]),
    S('phrygien', 'phrygien', [0, 1, 3, 5, 7, 8, 10]),
    S('lydien', 'lydien', [0, 2, 4, 6, 7, 9, 11]),
    S('mixolydien', 'mixolydien', [0, 2, 4, 5, 7, 9, 10]),
    S('eolien', 'éolien (mineur naturel)', [0, 2, 3, 5, 7, 8, 10]),
    S('locrien', 'locrien', [0, 1, 3, 5, 6, 8, 10]),
    S('locrien9', 'locrien ♮2', [0, 2, 3, 5, 6, 8, 10]),
    S('melodique', 'mineur mélodique', [0, 2, 3, 5, 7, 9, 11]),
    S('lydienb7', 'lydien ♭7', [0, 2, 4, 6, 7, 9, 10]),
    S('mixob9b13', 'mixolydien ♭9 ♭13', [0, 1, 4, 5, 7, 8, 10]),
    S('alteree', 'altérée', [0, 1, 3, 4, 6, 8, 10], [0, 1, 1, 2, 3, 5, 6]),
    S('dimHW', 'diminuée demi-ton/ton', [0, 1, 3, 4, 6, 7, 9, 10], [0, 1, 1, 2, 3, 4, 5, 6]),
    S('dimWH', 'diminuée ton/demi-ton', [0, 2, 3, 5, 6, 8, 9, 11], [0, 1, 2, 3, 4, 5, 5, 6]),
    S('tons', 'par tons', [0, 2, 4, 6, 8, 10], [0, 1, 2, 3, 4, 6]),
    S('blues', 'blues', [0, 3, 5, 6, 7, 10], [0, 2, 3, 4, 4, 6])
  ].map((s) => [s.id, s])
);

export function scaleNotes(root: Note, rootPc: number, id: string): Note[] {
  const s = SCALES[id];
  return s.iv.map((iv, i) => spellWith(root.letter + s.letters[i], rootPc + iv));
}
export const scaleNames = (root: Note, rootPc: number, id: string) => scaleNotes(root, rootPc, id).map(noteName);
export const scalePcs = (rootPc: number, id: string) => SCALES[id].iv.map((iv) => mod(rootPc + iv, 12));
