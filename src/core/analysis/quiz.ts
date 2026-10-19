// Quiz d'analyse sur une grille : choisir le degré d'un accord.
import { Key, keyOnPc } from '../chart/model';
import { Chord, QUALITIES } from '../theory/chords';
import { pcOf } from '../theory/notes';
import { Rng, shuffle } from '../random';
import { romanIn, romanSuffix } from './analyze';

/** Trois mauvaises réponses plausibles : le même accord lu dans des tonalités voisines, ou une autre fonction de dominante. */
export function romanChoices(c: Chord, answer: string, key: Key, rng: Rng = Math.random): string[] {
  const pc = pcOf(key.tonic);
  const keys = [0, 5, 7, 9, 3, 2, 10, 4].map((d) => keyOnPc(pc + d, key.mode)).concat([keyOnPc(pc, key.mode === 'major' ? 'minor' : 'major')]);
  const pool = new Set(keys.map((k) => romanIn(c, k)));
  if (QUALITIES[c.quality].family === 'dom') {
    const s = romanSuffix(c);
    for (const t of ['', '/II', '/V', '/VI', '/IV']) pool.add('V' + s + t);
    pool.add('SubV' + s);
    pool.add('♭VII' + s);
  }
  pool.delete(answer);
  return shuffle([answer, ...shuffle([...pool], rng).slice(0, 3)], rng);
}
