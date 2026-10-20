import { Chord, chordSymbol, parseChord } from '../theory/chords';
import { Note, noteName, parseNote, pcOf, spellWith, mod } from '../theory/notes';

export type Mode = 'major' | 'minor';
export interface Key {
  tonic: Note;
  mode: Mode;
}
export type Style = 'swing' | 'bossa' | 'ballade' | 'blues' | 'samba' | 'latin' | 'funk' | 'valse';

export interface ChordEvent {
  chord: Chord;
  /** Durée en temps. */
  beats: number;
}
export interface Bar {
  chords: ChordEvent[];
  /** Étiquette de section qui commence à cette mesure (A, B, Pont…). */
  section?: string;
}
export interface Chart {
  id: string;
  title: string;
  subtitle?: string;
  key: Key;
  tempo: number;
  style: Style;
  beatsPerBar: number;
  bars: Bar[];
  level: 1 | 2 | 3;
  notes?: string;
}

/** Accord « à plat » avec sa position dans la grille. */
export interface FlatChord extends ChordEvent {
  index: number;
  bar: number;
  /** Temps de début depuis le début de la grille. */
  start: number;
}

export function flatten(chart: Chart): FlatChord[] {
  const out: FlatChord[] = [];
  let t = 0;
  chart.bars.forEach((b, bi) => {
    b.chords.forEach((c) => {
      out.push({ ...c, index: out.length, bar: bi, start: t });
      t += c.beats;
    });
  });
  return out;
}

export const keyName = (k: Key) => noteName(k.tonic) + (k.mode === 'minor' ? 'm' : '');
export const keyLabel = (k: Key) => noteName(k.tonic) + (k.mode === 'minor' ? ' mineur' : ' majeur');

export function parseKey(s: string): Key | null {
  const r = parseNote(s.trim());
  if (!r) return null;
  const mode: Mode = /^(m|min|-)$/i.test(r.rest.trim()) ? 'minor' : 'major';
  return { tonic: r.note, mode };
}

/** Répartition des temps (entiers) quand n accords partagent une mesure (n ≤ temps par mesure). */
function splitBeats(n: number, beatsPerBar: number): number[] {
  if (n <= 1) return [beatsPerBar];
  if (beatsPerBar === 4 && n === 3) return [2, 1, 1];
  const base = Math.floor(beatsPerBar / n);
  return Array.from({ length: n }, (_, i) => (i === 0 ? beatsPerBar - base * (n - 1) : base));
}

/** Range des accords en mesures : au plus un accord par temps, le surplus passe à la mesure suivante. */
export function barsFrom(chords: Chord[], beatsPerBar: number, section?: string): Bar[] {
  const out: Bar[] = [];
  for (let i = 0; i < chords.length; i += beatsPerBar) {
    const group = chords.slice(i, i + beatsPerBar);
    const beats = splitBeats(group.length, beatsPerBar);
    out.push({ chords: group.map((c, k) => ({ chord: c, beats: beats[k] })), section: i === 0 ? section : undefined });
  }
  return out;
}

const STYLES: Style[] = ['swing', 'bossa', 'ballade', 'blues', 'samba', 'latin', 'funk', 'valse'];
const clampInt = (v: string | undefined, lo: number, hi: number, dflt: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

/**
 * Format texte des grilles :
 *   title: Autumn Leaves
 *   key: Gm
 *   tempo: 132
 *   [A]
 *   | Cm7 | F7 | B♭maj7 | E♭maj7 |
 * « % » répète la mesure précédente.
 */
export function parseChart(text: string, id = 'grille'): Chart {
  const meta: Record<string, string> = {};
  const bars: Bar[] = [];
  let pendingSection: string | undefined;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^([a-zA-Z]+)\s*:\s*(.+)$/.exec(line);
    if (m && !line.includes('|')) {
      meta[m[1].toLowerCase()] = m[2].trim();
      continue;
    }
    let rest = line;
    const sec = /^\[([^\]]+)\]\s*/.exec(rest);
    if (sec) {
      pendingSection = sec[1];
      rest = rest.slice(sec[0].length);
    }
    if (!rest) continue;
    const cells = rest.split('|').map((c) => c.trim()).filter((c) => c.length);
    const bpb = clampInt(meta.beats, 2, 7, 4);
    for (const cell of cells) {
      if (cell === '%') {
        const prev = bars[bars.length - 1];
        if (!prev) throw new Error('« % » sans mesure précédente');
        bars.push({ chords: prev.chords.map((c) => ({ ...c })), section: pendingSection });
      } else {
        const tokens = cell.split(/\s+/);
        const chords = tokens.map((t) => {
          const c = parseChord(t);
          if (!c) throw new Error(`Accord illisible : « ${t} »`);
          return c;
        });
        bars.push(...barsFrom(chords, bpb, pendingSection));
      }
      pendingSection = undefined;
    }
  }
  const key = parseKey(meta.key ?? 'C');
  if (!key) throw new Error('Tonalité illisible');
  return {
    id,
    title: meta.title ?? 'Sans titre',
    subtitle: meta.subtitle,
    key,
    tempo: clampInt(meta.tempo, 40, 320, 120),
    style: STYLES.includes(meta.style as Style) ? (meta.style as Style) : 'swing',
    beatsPerBar: clampInt(meta.beats, 2, 7, 4),
    level: clampInt(meta.level, 1, 3, 1) as 1 | 2 | 3,
    notes: meta.notes,
    bars
  };
}

export function chartToText(chart: Chart): string {
  const lines = [`title: ${chart.title}`, `key: ${keyName(chart.key)}`, `tempo: ${chart.tempo}`, `style: ${chart.style}`];
  let row: string[] = [];
  const flush = () => {
    if (row.length) lines.push('| ' + row.join(' | ') + ' |');
    row = [];
  };
  chart.bars.forEach((b) => {
    if (b.section) {
      flush();
      lines.push(`[${b.section}]`);
    }
    row.push(b.chords.map((c) => chordSymbol(c.chord)).join(' '));
    if (row.length === 4) flush();
  });
  flush();
  return lines.join('\n');
}

// --- Transposition -------------------------------------------------------

/** Orthographe usuelle des tonalités (moins d'altérations). */
const MAJOR_KEYS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const MINOR_KEYS = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

export function keyOnPc(pc: number, mode: Mode): Key {
  const name = (mode === 'major' ? MAJOR_KEYS : MINOR_KEYS)[mod(pc, 12)];
  return { tonic: parseNote(name)!.note, mode };
}

function transposeNote(n: Note, letterShift: number, semis: number): Note {
  return spellWith(n.letter + letterShift, pcOf(n) + semis);
}

export function transposeChart(chart: Chart, semis: number): Chart {
  const s = mod(semis, 12);
  if (s === 0) return chart;
  const newKey = keyOnPc(pcOf(chart.key.tonic) + s, chart.key.mode);
  const letterShift = mod(newKey.tonic.letter - chart.key.tonic.letter, 7);
  return {
    ...chart,
    key: newKey,
    bars: chart.bars.map((b) => ({
      ...b,
      chords: b.chords.map((c) => ({
        ...c,
        chord: {
          ...c.chord,
          root: transposeNote(c.chord.root, letterShift, s),
          bass: c.chord.bass ? transposeNote(c.chord.bass, letterShift, s) : undefined
        }
      }))
    }))
  };
}

