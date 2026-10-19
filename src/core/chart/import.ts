// Import tolérant de grilles copiées depuis une autre appli ou un site :
// lignes d'accords au-dessus des paroles, barres de mesure facultatives, sections entre crochets.
import { Bar, Chart, Key, Style } from './model';
import { Chord, parseChord } from '../theory/chords';
import { guessKey } from '../analysis/analyze';

export interface ImportResult {
  bars: Bar[];
  /** Symboles qui ressemblaient à des accords mais n'ont pas été compris. */
  unknown: string[];
  /** Les mesures viennent-elles de barres « | » (sinon : un accord par mesure). */
  measured: boolean;
  key: Key;
}

const SECTION = /^\s*[\[(]?\s*(intro|verse|couplet|refrain|chorus|pre-?chorus|bridge|pont|outro|coda|solo|interlude|instrumental|ending|fin|[A-D]\d?)\s*\d*\s*[\])]?\s*:?\s*$/i;
const NOISE = /^(n\.?c\.?|x\d+|\d+x|%|\/|-+|\.+|\(|\)|:\|\|?|\|\|:?|\d+\.)$/i;

function parseToken(t: string): Chord | null {
  const c = t.replace(/^[\[(]+/, '').replace(/[\],;]+$/, '');
  if (!c) return null;
  return parseChord(c, true) ?? parseChord(c.replace(/\)+$/, ''), true);
}
const looksLikeChord = (t: string) => /^[\[(]?[A-G][#b♯♭]?/.test(t);

export function importText(text: string): ImportResult {
  const bars: Bar[] = [];
  const unknown: string[] = [];
  let measured = false;
  let section: string | undefined;
  const push = (chords: Chord[]) => {
    if (!chords.length) return;
    const n = chords.length;
    const beats = n === 1 ? [4] : n === 2 ? [2, 2] : n === 3 ? [2, 1, 1] : chords.map(() => 4 / n);
    bars.push({ chords: chords.map((c, i) => ({ chord: c, beats: beats[i] ?? 1 })), section });
    section = undefined;
  };

  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const sec = SECTION.exec(line);
    if (sec && !line.includes('|')) {
      section = sec[1].length <= 2 ? sec[1].toUpperCase() : sec[1][0].toUpperCase() + sec[1].slice(1).toLowerCase();
      continue;
    }
    // Ligne mesurée : | Dm7 G7 | Cmaj7 |
    if (line.includes('|')) {
      const cells = line.split('|').map((c) => c.trim()).filter((c) => c && !/^:+$/.test(c));
      const parsedCells = cells.map((cell) =>
        cell === '%'
          ? 'repeat'
          : cell
              .split(/\s+/)
              .filter((t) => !NOISE.test(t))
              .map((t) => ({ t, c: parseToken(t) }))
      );
      const tokens = parsedCells.flatMap((x) => (x === 'repeat' ? [] : x));
      const ok = tokens.filter((x) => x.c).length;
      if (tokens.length && ok / tokens.length >= 0.6) {
        measured = true;
        parsedCells.forEach((cell) => {
          if (cell === 'repeat') {
            const prev = bars[bars.length - 1];
            if (prev) push(prev.chords.map((e) => e.chord));
            return;
          }
          cell.forEach((x) => !x.c && looksLikeChord(x.t) && unknown.push(x.t));
          push(cell.filter((x) => x.c).map((x) => x.c!));
        });
        continue;
      }
    }
    // Ligne d'accords libre : chaque accord occupe une mesure.
    const tokens = line.split(/\s+/).filter((t) => !NOISE.test(t));
    const parsed = tokens.map((t) => ({ t, c: parseToken(t) }));
    const ok = parsed.filter((x) => x.c).length;
    if (!tokens.length || ok / tokens.length < 0.6) continue; // paroles
    parsed.forEach((x) => {
      if (x.c) push([x.c]);
      else if (looksLikeChord(x.t)) unknown.push(x.t);
    });
  }
  return { bars, unknown: [...new Set(unknown)], measured, key: guessKey(bars.flatMap((b) => b.chords.map((c) => c.chord))) };
}

export function chartFromImport(r: ImportResult, opts: { id: string; title: string; key?: Key; tempo?: number; style?: Style }): Chart {
  return {
    id: opts.id,
    title: opts.title || 'Grille importée',
    key: opts.key ?? r.key,
    tempo: opts.tempo ?? 120,
    style: opts.style ?? 'swing',
    beatsPerBar: 4,
    level: 2,
    bars: r.bars
  };
}
