// Phrases : vocabulaire sur ii–V–I, à rejouer au piano (appel-réponse). Sans interface, testable.
import { Chord, chordSymbol, parseChord } from '../../core/theory/chords';
import { Key, keyOnPc } from '../../core/chart/model';
import { LETTERS, NATURAL_PC, lettersFor, mod, parseNote, pcOf, spellWith } from '../../core/theory/notes';
import { Written, midiOf } from '../../core/theory/staff';

export interface Line {
  id: string;
  level: number;
  name: string;
  /** Ce qu'il faut remarquer. */
  tip: string;
  /** Un accord par mesure, en C (ou C mineur). */
  chords: string[];
  minor?: boolean;
  /** Notes en C : « D4 » = croche, « D4:2 » = noire, « E5:8 » = ronde ; « | » sépare les mesures (ignoré). */
  text: string;
}

export const LEVELS = [
  'Arpèges en noires : 1-3-5-7, 3-5-7-9, en descendant',
  'Croches : arpège puis gamme, gamme bebop',
  'Approches chromatiques et encerclements',
  'Lignes : ♭9 et ♭13, ii–V–i mineur, dominante altérée'
];

export const LINES: Line[] = [
  {
    id: 'arp1357',
    level: 0,
    name: 'Arpèges 1-3-5-7',
    tip: 'Chaque accord monté de la fondamentale à la 7e. La 7e de G7 (F) descend d’un demi-ton sur la tierce de C (E).',
    chords: ['Dm7', 'G7', 'Cmaj7'],
    text: 'D4:2 F4:2 A4:2 C5:2 | G4:2 B4:2 D5:2 F5:2 | E5:8'
  },
  {
    id: 'arp3579',
    level: 0,
    name: 'Arpèges 3-5-7-9',
    tip: 'Partir de la tierce sonne plus jazz : 3-5-7-9, c’est le voicing sans fondamentale (type A) joué note à note.',
    chords: ['Dm7', 'G7', 'Cmaj7'],
    text: 'F4:2 A4:2 C5:2 E5:2 | B4:2 D5:2 F5:2 A5:2 | G5:8'
  },
  {
    id: 'arp7531',
    level: 0,
    name: 'Arpèges descendants',
    tip: '7-5-3-1 sur Dm7, 1-7-5-3 sur G7 : la tierce de G7 (B) monte d’un demi-ton sur C.',
    chords: ['Dm7', 'G7', 'Cmaj7'],
    text: 'C5:2 A4:2 F4:2 D4:2 | G4:2 F4:2 D4:2 B3:2 | C4:8'
  },
  {
    id: 'arpgamme',
    level: 1,
    name: 'Arpège puis gamme',
    tip: 'Monter en arpège, redescendre par la gamme : sur chaque temps, une note de l’accord.',
    chords: ['Dm7', 'G7', 'Cmaj7'],
    text: 'D4 F4 A4 C5 E5 D5 C5 A4 | B4 D5 F5 A5 G5 F5 D5 B4 | C5:8'
  },
  {
    id: 'bebop',
    level: 1,
    name: 'Gamme bebop',
    tip: 'La gamme bebop de dominante ajoute F♯ entre G et F : en descendant depuis G, les notes de G7 tombent toutes sur les temps.',
    chords: ['Dm7', 'G7', 'Cmaj7'],
    text: 'F4 G4 A4 B4 C5 D5 E5 F5 | G5 F♯5 F5 E5 D5 C5 B4 A4 | G4:8'
  },
  {
    id: 'chroma',
    level: 2,
    name: 'Approches chromatiques',
    tip: 'Sur les temps, les notes de l’accord. Entre elles, un demi-ton sous la note suivante : G♯ → A, A♯ → B, C♯ → D, D♯ → E.',
    chords: ['Dm7', 'G7', 'Cmaj7'],
    text: 'D4 E4 F4 G♯4 A4 B4 C5 A♯4 | B4 C♯5 D5 E5 F5 E5 D5 D♯5 | E5:8'
  },
  {
    id: 'enclos',
    level: 2,
    name: 'Encerclements',
    tip: 'La note visée est entourée : la note du dessus (dans la gamme), puis un demi-ton en dessous. C, A♯ → B ; F, D♯ → E.',
    chords: ['Dm7', 'G7', 'Cmaj7'],
    text: 'D4 F4 A4 C5 E5 D5 C5 A♯4 | B4 D5 F5 G5 A5 G5 F5 D♯5 | E5:8'
  },
  {
    id: 'bebopb9',
    level: 3,
    name: 'Ligne bebop, ♭9',
    tip: 'Sur G7, A♭ (♭9) et E♭ (♭13) assombrissent la dominante ; la ligne descend et se résout sur C.',
    chords: ['Dm7', 'G7♭9♭13', 'Cmaj7'],
    text: 'A4 C5 E5 G5 F5 E5 D5 C5 | B4 D5 F5 A♭5 G5 F5 E♭5 D5 | C5:8'
  },
  {
    id: 'mineur',
    level: 3,
    name: 'ii–V–i mineur',
    tip: 'En mineur, A♭ et E♭ viennent de la gamme ; la phrase finit sur la tierce mineure de Cm (E♭).',
    chords: ['Dø7', 'G7♭9♭13', 'Cm6'],
    minor: true,
    text: 'D4 F4 A♭4 C5 F5 E♭5 D5 C5 | B4 D5 F5 A♭5 G5 F5 E♭5 D5 | E♭5:8'
  },
  {
    id: 'alt',
    level: 3,
    name: 'Dominante altérée',
    tip: 'Sur G7alt : la triade de E♭ (♭13, 1, ♯9), puis A♭ (♭9) et D♭ (♭5) qui glisse d’un demi-ton sur C.',
    chords: ['Dm7', 'G7alt', 'Cmaj7'],
    text: 'A4 C5 E5 G5 F5 D5 C5 A4 | B4 E♭5 G5 B♭5 A♭5 F5 E♭5 D♭5 | C5:8'
  }
];
export const lineById = (id: string) => LINES.find((l) => l.id === id);

export interface PNote {
  w: Written;
  midi: number;
  /** Début et durée, en croches depuis le début de la phrase. */
  start: number;
  dur: number;
}
export interface Phrase {
  line: Line;
  key: Key;
  notes: PNote[];
  chords: Chord[];
}

const parseWritten = (tok: string): { w: Written; dur: number } => {
  const [n, d] = tok.split(':');
  const p = parseNote(n)!;
  return { w: { ...p.note, octave: Number(p.rest) }, dur: d ? Number(d) : 1 };
};

/** Les 12 tonalités par quartes, en partant de C. */
export const CYCLE = Array.from({ length: 12 }, (_, i) => (i * 5) % 12);

/** La phrase dans la tonalité dont la tonique a la classe de hauteur `pc`, dans un registre de main droite. */
export function phraseIn(line: Line, pc: number): Phrase {
  const key = keyOnPc(pc, line.minor ? 'minor' : 'major');
  const shift = key.tonic.letter;
  const semis = pcOf(key.tonic);
  let t = 0;
  const base = line.text
    .split(/\s+/)
    .filter((x) => x && x !== '|')
    .map((tok) => {
      const { w, dur } = parseWritten(tok);
      const n = { w, midi: midiOf(w), start: t, dur };
      t += dur;
      return n;
    });
  // Transposition vers le haut ou vers le bas, au plus près du registre d'origine.
  const up = semis <= 6 ? semis : semis - 12;
  const notes = base.map((n) => {
    const m = n.midi + up;
    let s = spellWith(n.w.letter + shift, m);
    // Double altération (G𝄪 en B majeur) : on écrit la note voisine (A), plus lisible.
    if (Math.abs(s.acc) >= 2) s = spellWith(lettersFor(m).find((l) => spellWith(l, m).acc === 0) ?? s.letter, m);
    const octave = Math.round((m - NATURAL_PC[s.letter] - s.acc) / 12) - 1;
    return { ...n, midi: m, w: { ...s, octave } };
  });
  const chords = line.chords.map((sym) => {
    const c = parseChord(sym)!;
    return { ...c, root: spellWith(c.root.letter + shift, pcOf(c.root) + semis) };
  });
  return { line, key, notes, chords };
}

export const phraseLength = (p: Phrase) => p.notes.reduce((s, n) => Math.max(s, n.start + n.dur), 0);
export const chordNames = (p: Phrase) => p.chords.map(chordSymbol);
export const noteLabel = (w: Written) => LETTERS[w.letter] + (w.acc > 0 ? '♯' : w.acc < 0 ? '♭' : '');

export interface Match {
  /** Pour chaque note de la phrase : jouée (dans l'ordre) ou non. */
  ok: boolean[];
  matched: number;
  /** Notes jouées en trop (ou fausses). */
  extra: number;
  /** La phrase est réussie : toutes les notes, au plus 2 en trop (le micro en invente parfois). */
  pass: boolean;
}

/** Compare les notes jouées à la phrase, dans l'ordre (plus longue sous-suite commune, à l'octave près). */
export function matchPhrase(target: number[], played: number[]): Match {
  const n = target.length;
  const m = played.length;
  const same = (a: number, b: number) => mod(a, 12) === mod(b, 12);
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--) L[i][j] = same(target[i], played[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ok = new Array(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (same(target[i], played[j]) && L[i][j] === L[i + 1][j + 1] + 1) {
      ok[i] = true;
      i++;
      j++;
    } else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const matched = L[0][0];
  const extra = m - matched;
  return { ok, matched, extra, pass: matched === n && extra <= 2 };
}
