import { Note, mod, noteName, parseNote, pcOf, spellWith, lettersFor, spellCost } from './notes';

export type Family = 'maj' | 'min' | 'dom' | 'hdim' | 'dim' | 'aug';

export interface Quality {
  id: string;
  /** Suffixe affiché après la fondamentale. */
  sym: string;
  /** Nom en français. */
  name: string;
  /** Intervalles en demi-tons depuis la fondamentale. */
  iv: number[];
  /** Écart de lettre de chaque note (0 = fondamentale, 2 = tierce…), pour l'orthographe. */
  dg: number[];
  family: Family;
  /** Accord suspendu (fonction de dominante sans tierce). */
  sus?: boolean;
  /** Intervalles facultatifs (ex. quinte d'un 13). */
  optional?: number[];
}

const q = (id: string, sym: string, name: string, iv: number[], dg: number[], family: Family, extra: Partial<Quality> = {}): Quality => ({
  id, sym, name, iv, dg, family, ...extra
});

export const QUALITIES: Record<string, Quality> = Object.fromEntries(
  [
    q('maj', '', 'majeur', [0, 4, 7], [0, 2, 4], 'maj'),
    q('maj7', 'maj7', 'majeur 7', [0, 4, 7, 11], [0, 2, 4, 6], 'maj'),
    q('6', '6', 'majeur 6', [0, 4, 7, 9], [0, 2, 4, 5], 'maj'),
    q('69', '6/9', 'majeur 6/9', [0, 4, 7, 9, 14], [0, 2, 4, 5, 1], 'maj'),
    q('maj9', 'maj9', 'majeur 9', [0, 4, 7, 11, 14], [0, 2, 4, 6, 1], 'maj'),
    q('maj7#11', 'maj7♯11', 'majeur 7 ♯11', [0, 4, 7, 11, 18], [0, 2, 4, 6, 3], 'maj'),
    q('min', 'm', 'mineur', [0, 3, 7], [0, 2, 4], 'min'),
    q('m7', 'm7', 'mineur 7', [0, 3, 7, 10], [0, 2, 4, 6], 'min'),
    q('m6', 'm6', 'mineur 6', [0, 3, 7, 9], [0, 2, 4, 5], 'min'),
    q('m9', 'm9', 'mineur 9', [0, 3, 7, 10, 14], [0, 2, 4, 6, 1], 'min'),
    q('m11', 'm11', 'mineur 11', [0, 3, 7, 10, 14, 17], [0, 2, 4, 6, 1, 3], 'min'),
    q('mM7', 'm(maj7)', 'mineur maj7', [0, 3, 7, 11], [0, 2, 4, 6], 'min'),
    q('7', '7', 'dominante', [0, 4, 7, 10], [0, 2, 4, 6], 'dom'),
    q('9', '9', 'dominante 9', [0, 4, 7, 10, 14], [0, 2, 4, 6, 1], 'dom'),
    q('13', '13', 'dominante 13', [0, 4, 7, 10, 14, 21], [0, 2, 4, 6, 1, 5], 'dom', { optional: [7] }),
    q('7b9', '7♭9', 'dominante ♭9', [0, 4, 7, 10, 13], [0, 2, 4, 6, 1], 'dom'),
    q('7#9', '7♯9', 'dominante ♯9', [0, 4, 7, 10, 15], [0, 2, 4, 6, 1], 'dom'),
    q('7#11', '7♯11', 'dominante ♯11', [0, 4, 7, 10, 18], [0, 2, 4, 6, 3], 'dom'),
    q('7b13', '7♭13', 'dominante ♭13', [0, 4, 7, 10, 20], [0, 2, 4, 6, 5], 'dom'),
    q('7alt', '7alt', 'dominante altérée', [0, 4, 10, 13, 15, 20], [0, 2, 6, 1, 1, 5], 'dom'),
    q('7#5', '7♯5', 'dominante ♯5', [0, 4, 8, 10], [0, 2, 4, 6], 'dom'),
    q('7b5', '7♭5', 'dominante ♭5', [0, 4, 6, 10], [0, 2, 4, 6], 'dom'),
    q('7sus4', '7sus4', 'dominante sus4', [0, 5, 7, 10], [0, 3, 4, 6], 'dom', { sus: true }),
    q('9sus4', '9sus4', 'dominante 9 sus4', [0, 5, 7, 10, 14], [0, 3, 4, 6, 1], 'dom', { sus: true }),
    q('sus4', 'sus4', 'suspendu', [0, 5, 7], [0, 3, 4], 'maj', { sus: true }),
    q('m7b5', 'ø7', 'demi-diminué', [0, 3, 6, 10], [0, 2, 4, 6], 'hdim'),
    q('dim7', '°7', 'diminué 7', [0, 3, 6, 9], [0, 2, 4, 6], 'dim'),
    q('dim', '°', 'diminué', [0, 3, 6], [0, 2, 4], 'dim'),
    q('aug', '+', 'augmenté', [0, 4, 8], [0, 2, 4], 'aug')
  ].map((x) => [x.id, x])
);

// Alias de saisie → qualité. Les clés sont normalisées (voir normalizeSuffix).
const ALIASES: Record<string, string> = {
  '': 'maj', maj: 'maj', M: 'maj',
  maj7: 'maj7', M7: 'maj7', ma7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', '^': 'maj7', '^7': 'maj7',
  '6': '6', maj6: '6', '69': '69', '6/9': '69',
  maj9: 'maj9', 'Δ9': 'maj9', M9: 'maj9', 'maj7#11': 'maj7#11', 'Δ#11': 'maj7#11', 'Δ7#11': 'maj7#11',
  m: 'min', m7: 'm7', m6: 'm6', m9: 'm9', m11: 'm11',
  'mmaj7': 'mM7', 'm(maj7)': 'mM7', mM7: 'mM7', 'mΔ7': 'mM7', 'mΔ': 'mM7', 'm^7': 'mM7',
  '7': '7', '9': '9', '13': '13', '7b9': '7b9', '7#9': '7#9', '7#11': '7#11', '7b13': '7b13',
  '7alt': '7alt', alt: '7alt', '7#5': '7#5', '+7': '7#5', '7+': '7#5', aug7: '7#5', '7b5': '7b5',
  '13b9': '7b9', '7b9b13': '7alt', '7#9b13': '7alt', '7#9#5': '7alt', '9#11': '7#11', '13#11': '7#11',
  '7sus4': '7sus4', '7sus': '7sus4', sus7: '7sus4', '9sus4': '9sus4', '9sus': '9sus4', '13sus': '9sus4', '13sus4': '9sus4',
  sus4: 'sus4', sus: 'sus4',
  'ø': 'm7b5', 'ø7': 'm7b5', m7b5: 'm7b5', 'm7(b5)': 'm7b5',
  '°7': 'dim7', '°': 'dim', o7: 'dim7', o: 'dim', dim7: 'dim7', dim: 'dim',
  '+': 'aug', aug: 'aug'
};

function normalizeSuffix(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, '')
    .replace(/♭/g, 'b')
    .replace(/♯/g, '#')
    .replace(/[()]/g, '')
    .replace(/^-/, 'm') // -7 → m7
    .replace(/^min/, 'm')
    .replace(/^mi(?=\d|$)/, 'm')
    .replace(/^Maj/, 'maj')
    .replace(/^mMaj/, 'mmaj');
}

export interface Chord {
  root: Note;
  quality: string;
  bass?: Note;
}

// Notations rencontrées dans les applis de grilles (françaises, brésiliennes, guitare) : C7M, G7(9), A7(b9)…
const LENIENT: Record<string, string> = {
  '7M': 'maj7', '7M9': 'maj9', maj79: 'maj9', M79: 'maj9', '7M#11': 'maj7#11', '7+': '7#5', 'm7M': 'mM7', 'm7M9': 'mM7',
  m79: 'm9', m711: 'm11', m7911: 'm11', '79': '9', '713': '13', '7913': '13', '7b913': '7b9', '74': '7sus4', '7sus49': '9sus4',
  '4': 'sus4', '2': 'maj', sus2: 'maj', add9: 'maj', madd9: 'min', '5': 'maj', '6add9': '69', m6add9: 'm6', m69: 'm6', '7/9': '9',
  '7/13': '13', '7/b9': '7b9', '7/#9': '7#9', '7/#11': '7#11', '7/b13': '7b13', 'm7/9': 'm9', 'm7/11': 'm11', '7M/9': 'maj9'
};
const EXTENSION_TAIL = /^[0-9b#,/+addsusMmajo°ø()\-]*$/;

function lenientQuality(key: string): string | null {
  if (LENIENT[key]) return LENIENT[key];
  let best = '';
  for (const k of Object.keys(ALIASES)) if (k && key.startsWith(k) && k.length > best.length) best = k;
  if (best && EXTENSION_TAIL.test(key.slice(best.length))) return ALIASES[best];
  return null;
}

/**
 * Lit un symbole d'accord. En mode tolérant (import de grilles), accepte aussi C7M, G7(9),
 * A7(b9), Bm7(b5) et ignore les extensions inconnues plutôt que de rejeter l'accord.
 */
export function parseChord(input: string, lenient = false): Chord | null {
  const r = parseNote(input.trim());
  if (!r) return null;
  if (lenient && /^[a-z]/.test(r.rest) && !/^(m|maj|min|mi|sus|add|dim|aug|alt|o7)/.test(r.rest)) return null;
  let rest = r.rest;
  let bass: Note | undefined;
  const slash = rest.lastIndexOf('/');
  if (slash >= 0 && !/^6\/9/.test(rest.slice(slash - 1))) {
    const b = parseNote(rest.slice(slash + 1));
    if (b && b.rest === '') {
      bass = b.note;
      rest = rest.slice(0, slash);
    }
  }
  const key = normalizeSuffix(rest);
  const id = ALIASES[key] ?? ALIASES[rest] ?? (lenient ? lenientQuality(normalizeSuffix(rest.replace(/[(),]/g, ''))) : null);
  if (!id) return null;
  return { root: r.note, quality: id, bass };
}

export const qualityOf = (c: Chord) => QUALITIES[c.quality];
export const rootPc = (c: Chord) => pcOf(c.root);
export const familyOf = (c: Chord) => QUALITIES[c.quality].family;

export function chordSymbol(c: Chord): string {
  return noteName(c.root) + QUALITIES[c.quality].sym + (c.bass ? '/' + noteName(c.bass) : '');
}

/** Notes de l'accord, orthographiées à partir de la lettre de la fondamentale. */
export function chordNotes(c: Chord): Note[] {
  const qq = QUALITIES[c.quality];
  const r = rootPc(c);
  return qq.iv.map((iv, i) => spellWith(c.root.letter + qq.dg[i], r + iv));
}

export const chordPcs = (c: Chord) => QUALITIES[c.quality].iv.map((iv) => mod(rootPc(c) + iv, 12));

/** Construit un accord sur une classe de hauteur en choisissant l'orthographe la plus lisible. */
export function chordOnPc(pc: number, quality: string): Chord {
  const qq = QUALITIES[quality];
  let best: { c: Chord; cost: number } | null = null;
  for (const l of lettersFor(pc)) {
    const root = spellWith(l, pc);
    const notes = qq.iv.map((iv, i) => spellWith(l + qq.dg[i], pc + iv));
    const cost = spellCost(notes) + (root.acc > 0 ? 0.5 : 0);
    if (!best || cost < best.cost) best = { c: { root, quality }, cost };
  }
  return best!.c;
}

/** Nom d'une note jouée sur l'accord, y compris les extensions (9, ♯11, 13…). */
export function spellInChord(c: Chord, pc: number): string {
  const tones = chordNotes(c);
  const hit = tones.find((n) => pcOf(n) === mod(pc, 12));
  if (hit) return noteName(hit);
  const d = mod(pc - rootPc(c), 12);
  const hasMinor3 = QUALITIES[c.quality].iv.includes(3);
  const OFF: Record<number, number> = { 0: 0, 1: 1, 2: 1, 3: hasMinor3 ? 2 : 1, 4: 2, 5: 3, 6: 3, 7: 4, 8: 5, 9: 5, 10: 6, 11: 6 };
  return noteName(spellWith(c.root.letter + OFF[d], pc));
}
