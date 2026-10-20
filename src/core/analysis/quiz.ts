// Quiz d'analyse sur une grille : choisir le degré d'un accord.
import { Key, keyOnPc } from '../chart/model';
import { Chord, QUALITIES } from '../theory/chords';
import { mod, pcOf, spellWith } from '../theory/notes';
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

const numeral = (r: string) => r.replace(/(Δ7|m7|m6|ø7|°7|7)$/, '');

/**
 * Chiffrage fonctionnel d'une suite dans une tonalité donnée : un 7 qui monte de quarte s'écrit V7/X,
 * un 7 qui descend d'un demi-ton SubV7(/X), comme dans les enchaînements types.
 */
export function functionalRomans(chords: Chord[], key: Key): string[] {
  return chords.map((c, i) => {
    const raw = romanIn(c, key);
    if (QUALITIES[c.quality].family !== 'dom') return raw;
    const s = romanSuffix(c);
    if (raw === 'V' + s) return raw;
    // Sans accord suivant (ii–V non résolu), on lit le 7 vers sa résolution naturelle, une quarte plus haut.
    const next = chords[i + 1] ?? { root: spellWith(c.root.letter + 3, pcOf(c.root) + 5), quality: 'maj7' };
    const target = numeral(romanIn(next, key));
    const d = mod(pcOf(next.root) - pcOf(c.root), 12);
    if (d === 5) return `V${s}/${target}`;
    if (d === 11) return target === 'I' ? `SubV${s}` : `SubV${s}/${target}`;
    return raw;
  });
}

/**
 * Mauvaises réponses pour « quel enchaînement ? » : les mêmes accords lus dans d'autres tonalités.
 * Même nombre d'accords, mêmes types : seul le chiffrage diffère, il faut vraiment analyser.
 */
export function patternChoices(chords: Chord[], key: Key, answer: string, rng: Rng = Math.random): string[] {
  const pc = pcOf(key.tonic);
  const other = key.mode === 'major' ? 'minor' : 'major';
  const keys = [
    keyOnPc(pc + 5, key.mode),
    keyOnPc(pc + 7, key.mode),
    keyOnPc(key.mode === 'major' ? pc + 9 : pc + 3, other),
    keyOnPc(pc + 2, key.mode),
    keyOnPc(pc + 10, key.mode),
    keyOnPc(pc + 4, key.mode),
    keyOnPc(pc + 8, key.mode),
    keyOnPc(pc + 3, key.mode),
    keyOnPc(pc + 5, other),
    keyOnPc(pc + 7, other)
  ];
  const lines: { l: string; odd: number }[] = [];
  for (const k of keys) {
    const r = functionalRomans(chords, k);
    const l = r.join(' – ');
    if (l === answer || lines.some((x) => x.l === l) || /[𝄫𝄪]|♭♭|♯♯/.test(l)) continue;
    // Moins il y a de degrés altérés, plus la lecture est crédible.
    lines.push({ l, odd: r.filter((x) => /^[♭♯]/.test(x)).length });
  }
  const best = lines.sort((a, b) => a.odd - b.odd).slice(0, 5).map((x) => x.l);
  return shuffle([answer, ...shuffle(best, rng).slice(0, 3)], rng);
}
