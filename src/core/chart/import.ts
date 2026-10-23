// Import tolérant de grilles copiées depuis une autre appli ou un site (Ultimate Guitar, ChordPro…) :
// lignes d'accords au-dessus des paroles, barres de mesure facultatives, sections, capo.
import { Bar, Chart, Key, Style, barsFrom, keyOnPc, parseKey, transposeChart } from './model';
import { Chord, parseChord } from '../theory/chords';
import { mod, pcOf } from '../theory/notes';
import { guessKey } from '../analysis/analyze';

export interface ImportResult {
  bars: Bar[];
  /** Symboles qui ressemblaient à des accords mais n'ont pas été compris. */
  unknown: string[];
  /** Les mesures viennent-elles de barres « | » (sinon : un accord par mesure). */
  measured: boolean;
  key: Key;
  /** Titre trouvé dans le texte ({title: …} en ChordPro). */
  title?: string;
  /** Capo indiqué dans le texte (frette), 0 si aucun. */
  capo: number;
  /** Le capo a-t-il été appliqué (accords transposés à la hauteur réelle). */
  capoApplied: boolean;
  tempo?: number;
  /** Lignes de paroles gardées (sous les accords). */
  lyricLines: number;
}
export interface ImportOptions {
  /** Transposer selon le capo (par défaut : oui). */
  applyCapo?: boolean;
}

const SECTION_WORD =
  /^\s*[\[(]?\s*(intro|verse|couplet|refrain|chorus|pre-?chorus|bridge|pont|outro|coda|solo|interlude|instrumental|ending|fin)\s*\d*\s*[\])]?\s*:?\s*$/i;
// Une lettre seule (A, B…) n'est une section qu'entre crochets ou suivie de « : » — sinon c'est un accord.
const SECTION_LETTER = /^\s*(?:\[\s*([A-D]\d?)\s*\]|\(\s*([A-D]\d?)\s*\)|([A-D]\d?)\s*:)\s*$/;
function sectionOf(line: string): string | null {
  const w = SECTION_WORD.exec(line);
  if (w) return capitalize(w[1]);
  const l = SECTION_LETTER.exec(line);
  if (l) return (l[1] ?? l[2] ?? l[3]).toUpperCase();
  return null;
}
const NOISE = /^(n\.?c\.?|[\[(]?x\s?\d{1,2}[\])]?|[\[(]?\d{1,2}\s?x[\])]?|%|\/|-+|\.+|\(|\)|\*+|→|:?\|\|?:?|\d+\.)$/i;
const META = /^(tuning|accordage|author|artist|auteur|difficulty|difficulté|strumming|chords?|accords?)\s*:/i;
const CAPO = /^capo\s*[:\-]?\s*(?:on\s*)?(\d+)/i;
const KEYLINE = /^(?:key|tonalité)\s*:\s*([A-G][#b♯♭]?m?)(?=\s|$)/i;
const TEMPO = /^(?:tempo|bpm)\s*:?\s*(\d+)/i;
const DIRECTIVE = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i;
const INLINE = /\[([^\]]+)\]/g;

function parseToken(t: string): Chord | null {
  const c = t.replace(/^[\[(]+/, '').replace(/[\],;]+$/, '');
  if (!c) return null;
  return parseChord(c, true) ?? parseChord(c.replace(/\)+$/, ''), true);
}
const looksLikeChord = (t: string) => /^[\[(]?[A-G][#b♯♭]?/.test(t);
const capitalize = (s: string) => (s.length <= 2 ? s.toUpperCase() : s[0].toUpperCase() + s.slice(1).toLowerCase());

/** Une ligne de paroles (pas de la tablature, pas un diagramme d'accord). */
const isLyric = (line: string) => /\p{L}{2,}/u.test(line) && !/-{3,}/.test(line) && !/^[A-Ga-g]\s*\|/.test(line);

/**
 * Coupe une ligne de paroles aux colonnes des accords écrits au-dessus : à chaque accord, le texte jusqu'à l'accord
 * suivant. Un accord au milieu d'un mot prend le mot entier. Le texte avant le premier accord (levée) va au premier.
 */
export function splitLyric(lyric: string, cols: number[]): string[] {
  const cuts: number[] = [];
  cols.forEach((c, i) => {
    let x = i === 0 ? 0 : Math.min(c, lyric.length);
    while (x > 0 && /\S/.test(lyric[x - 1]) && /\S/.test(lyric[x] ?? ' ')) x--;
    cuts.push(Math.max(x, cuts[i - 1] ?? 0));
  });
  return cuts.map((c, i) => lyric.slice(c, cuts[i + 1]).trim().replace(/\s+/g, ' '));
}

const CHORDPRO_SECTIONS: Record<string, string> = {
  soc: 'Refrain', start_of_chorus: 'Refrain', sov: 'Couplet', start_of_verse: 'Couplet', sob: 'Pont', start_of_bridge: 'Pont'
};

export function importText(text: string, opts: ImportOptions = {}): ImportResult {
  let bars: Bar[] = [];
  const unknown: string[] = [];
  let measured = false;
  let section: string | undefined;
  let title: string | undefined;
  let capo = 0;
  let keyLine: Key | null = null;
  let tempo: number | undefined;

  /** Mesures et colonnes des accords de la dernière ligne d'accords libre, en attente de ses paroles. */
  let above: { bars: number[]; cols: number[] } | null = null;
  let lyricLines = 0;
  let lineStart = true;
  const addLyric = (bar: number, text: string) => {
    if (!text || !bars[bar]) return;
    bars[bar].lyric = bars[bar].lyric ? `${bars[bar].lyric} / ${text}` : text;
  };
  const push = (chords: Chord[]) => {
    if (!chords.length) return;
    const from = bars.length;
    bars.push(...barsFrom(chords, 4, section));
    // Chaque ligne du texte commence une ligne de la grille (les paroles s'y retrouvent).
    if (lineStart) bars[from].line = true;
    lineStart = false;
    section = undefined;
  };

  // Balises du format brut d'Ultimate Guitar : [ch]Am[/ch], [tab]…[/tab]
  const cleaned = text.replace(/\r/g, '').replace(/\[ch\](.*?)\[\/ch\]/g, '$1').replace(/\[\/?tab\]/g, '');

  for (const rawLine of cleaned.split('\n')) {
    const raw = rawLine.replace(/\t/g, '    ').replace(/\s+$/, '');
    const line = raw.trim();
    lineStart = true;
    if (!line) continue;
    const pending = above;
    above = null;

    // Métadonnées
    const dir = DIRECTIVE.exec(line);
    if (dir) {
      const name = dir[1].toLowerCase();
      const val = (dir[2] ?? '').trim();
      if (name === 'title' || name === 't') title = val;
      else if (name === 'key') keyLine = parseKey(val);
      else if (name === 'capo') capo = Number(val) || 0;
      else if (name === 'tempo') tempo = Number(val) || undefined;
      else if (CHORDPRO_SECTIONS[name]) section = CHORDPRO_SECTIONS[name];
      else if ((name === 'c' || name === 'comment' || name === 'ci') && sectionOf(val)) section = sectionOf(val)!;
      continue;
    }
    const cap = CAPO.exec(line);
    if (cap) {
      capo = Number(cap[1]);
      continue;
    }
    const kl = KEYLINE.exec(line);
    if (kl) {
      keyLine = parseKey(kl[1]);
      continue;
    }
    const tp = TEMPO.exec(line);
    if (tp) {
      tempo = Number(tp[1]);
      continue;
    }
    if (META.test(line)) continue;
    const sec = line.includes('|') ? null : sectionOf(line);
    if (sec) {
      section = sec;
      continue;
    }

    // ChordPro : [Am7]paroles [D7]suite
    const matches = [...line.matchAll(INLINE)];
    const inline = matches.map((m) => m[1]);
    if (inline.length && line.replace(INLINE, '').trim().length > 0) {
      const chords = inline.map((t) => parseToken(t));
      if (chords.some((c) => c)) {
        let sung = false;
        matches.forEach((m, i) => {
          const end = matches[i + 1]?.index ?? line.length;
          const text = line.slice(m.index! + m[0].length, end).trim().replace(/\s+/g, ' ');
          // Levée : le texte avant le premier accord va avec lui.
          const before = i === 0 ? line.slice(0, m.index).trim() : '';
          const words = [before, text].filter(Boolean).join(' ');
          if (chords[i]) push([chords[i]!]);
          else if (looksLikeChord(inline[i])) unknown.push(inline[i]);
          if (words) {
            addLyric(bars.length - 1, words);
            sung = true;
          }
        });
        if (sung) lyricLines++;
        continue;
      }
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
    const found = [...raw.matchAll(/\S+/g)].filter((m) => !NOISE.test(m[0]));
    const parsed = found.map((m) => ({ t: m[0], col: m.index!, c: parseToken(m[0]) }));
    const ok = parsed.filter((x) => x.c).length;
    if (!found.length || ok / found.length < 0.6) {
      // Paroles : sous une ligne d'accords, coupées aux accords ; sinon, à la suite de la dernière mesure.
      if (isLyric(line) && bars.length) {
        if (pending) splitLyric(raw, pending.cols).forEach((t, i) => addLyric(pending.bars[i], t));
        else addLyric(bars.length - 1, line.replace(/\s+/g, ' '));
        lyricLines++;
      }
      continue;
    }
    const at = { bars: [] as number[], cols: [] as number[] };
    parsed.forEach((x) => {
      if (x.c) {
        push([x.c]);
        at.bars.push(bars.length - 1);
        at.cols.push(x.col);
      } else if (looksLikeChord(x.t)) unknown.push(x.t);
    });
    if (at.bars.length) above = at;
  }

  const chordsOf = (bs: Bar[]) => bs.flatMap((b) => b.chords.map((c) => c.chord));
  const shapeKey = guessKey(chordsOf(bars));
  const applyCapo = opts.applyCapo !== false && capo > 0 && capo < 12;
  if (applyCapo) {
    // Avec un capo, les accords écrits sont des formes de guitare : on les ramène à la hauteur réelle.
    const tmp: Chart = { id: 'tmp', title: '', key: shapeKey, tempo: 120, style: 'swing', beatsPerBar: 4, level: 1, bars };
    bars = transposeChart(tmp, capo).bars;
  }
  let key = guessKey(chordsOf(bars));
  if (keyLine) {
    const k = keyLine as Key;
    const kpc = pcOf(k.tonic);
    const g = pcOf(key.tonic);
    const relative = mod(k.mode === 'major' ? kpc + 9 : kpc + 3, 12);
    if (kpc === g || relative === g) key = k;
    else if (applyCapo && mod(kpc + capo, 12) === g) key = keyOnPc(kpc + capo, k.mode);
  }
  return { bars, unknown: [...new Set(unknown)], measured, key, title, capo, capoApplied: applyCapo, tempo, lyricLines };
}

export function chartFromImport(r: ImportResult, opts: { id: string; title: string; key?: Key; tempo?: number; style?: Style }): Chart {
  const style = opts.style ?? 'swing';
  return {
    id: opts.id,
    title: opts.title || r.title || 'Grille importée',
    key: opts.key ?? r.key,
    tempo: opts.tempo ?? r.tempo ?? 120,
    style,
    beatsPerBar: 4,
    level: 2,
    // Styles pop : l'analyse parle en suites de la pop (I – V – vi – IV…) plutôt qu'en ii–V–I.
    genre: style === 'rock' || style === 'slow' ? 'pop' : 'jazz',
    bars: r.bars
  };
}
