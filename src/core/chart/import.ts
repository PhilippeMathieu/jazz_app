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

  const push = (chords: Chord[]) => {
    if (!chords.length) return;
    bars.push(...barsFrom(chords, 4, section));
    section = undefined;
  };

  // Balises du format brut d'Ultimate Guitar : [ch]Am[/ch], [tab]…[/tab]
  const cleaned = text.replace(/\r/g, '').replace(/\[ch\](.*?)\[\/ch\]/g, '$1').replace(/\[\/?tab\]/g, '');

  for (const raw of cleaned.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

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
    const inline = [...line.matchAll(INLINE)].map((m) => m[1]);
    if (inline.length && line.replace(INLINE, '').trim().length > 0) {
      const chords = inline.map((t) => parseToken(t));
      if (chords.some((c) => c)) {
        inline.forEach((t, i) => (chords[i] ? push([chords[i]!]) : looksLikeChord(t) && unknown.push(t)));
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
    const tokens = line.split(/\s+/).filter((t) => !NOISE.test(t));
    const parsed = tokens.map((t) => ({ t, c: parseToken(t) }));
    const ok = parsed.filter((x) => x.c).length;
    if (!tokens.length || ok / tokens.length < 0.6) continue; // paroles, diagrammes, tablature
    parsed.forEach((x) => {
      if (x.c) push([x.c]);
      else if (looksLikeChord(x.t)) unknown.push(x.t);
    });
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
  return { bars, unknown: [...new Set(unknown)], measured, key, title, capo, capoApplied: applyCapo, tempo };
}

export function chartFromImport(r: ImportResult, opts: { id: string; title: string; key?: Key; tempo?: number; style?: Style }): Chart {
  return {
    id: opts.id,
    title: opts.title || r.title || 'Grille importée',
    key: opts.key ?? r.key,
    tempo: opts.tempo ?? r.tempo ?? 120,
    style: opts.style ?? 'swing',
    beatsPerBar: 4,
    level: 2,
    bars: r.bars
  };
}
