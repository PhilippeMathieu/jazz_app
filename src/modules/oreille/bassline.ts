// Oreille › Ligne de basse : entendre les fondamentales et dire leur degré dans la tonalité. Sans interface, testable.
import { Chart, Key, flatten, keyOnPc } from '../../core/chart/model';
import { Chord, chordSymbol } from '../../core/theory/chords';
import { Note, mod, noteName, pcOf, spellWith } from '../../core/theory/notes';
import { ArrEvent, arrangeChorus, newArrangeState, walkingLine } from '../../core/player/arrange';
import { closeVoicing } from '../../core/audio/voicing';
import { Rng, pick, rndInt, weightedPick } from '../../core/random';
import { Pair, confusionWeight } from '../../core/confusions';
import { INTERVALS } from './intervals';
import { Tally } from './questions';

export interface Degree {
  id: string;
  semis: number;
  /** Lettre au-dessus de la tonique (0 = I … 6 = VII), pour l'orthographe. */
  letter: number;
}
const D = (id: string, semis: number, letter: number): Degree => ({ id, semis, letter });
/** Dans l'ordre chromatique. */
export const DEGREES: Degree[] = [
  D('I', 0, 0),
  D('♭II', 1, 1),
  D('II', 2, 1),
  D('♭III', 3, 2),
  D('III', 4, 2),
  D('IV', 5, 3),
  D('V', 7, 4),
  D('♭VI', 8, 5),
  D('VI', 9, 5),
  D('♭VII', 10, 6),
  D('VII', 11, 6)
];
export const degreeById = (id: string) => DEGREES.find((d) => d.id === id);
const DIATONIC = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const ALL = DEGREES.map((d) => d.id);

export interface BassLevel {
  ids: string[];
  desc: string;
  /** La ligne part de la tonique. */
  fromTonic?: boolean;
  /** Avec piano et batterie, en walking bass. */
  walking?: boolean;
}
export const BASS_LEVELS: BassLevel[] = [
  { ids: ['I', 'IV', 'V'], fromTonic: true, desc: 'Débutant : I, IV et V ; la ligne part de la tonique' },
  { ids: ['I', 'II', 'IV', 'V', 'VI'], fromTonic: true, desc: '+ II et VI, les degrés des grilles les plus courantes' },
  { ids: DIATONIC, desc: 'Les 7 degrés de la gamme majeure' },
  { ids: ALL, desc: '+ ♭II, ♭III, ♭VI, ♭VII : SubV, emprunts, backdoor' },
  { ids: ALL, walking: true, desc: 'En vrai : walking bass avec piano et batterie, la fondamentale de chaque mesure' }
];
export const BASS_NOTES = 4;

/** Grilles de 4 mesures pour le niveau walking : degré et nature de chaque accord. */
const WALK_PROGS: [string, string][][] = [
  [['I', 'maj7'], ['VI', 'm7'], ['II', 'm7'], ['V', '7']],
  [['III', 'm7'], ['VI', '7'], ['II', 'm7'], ['V', '7']],
  [['I', 'maj7'], ['IV', '7'], ['I', 'maj7'], ['V', '7']],
  [['IV', 'm7'], ['♭VII', '7'], ['I', 'maj7'], ['VI', '7']],
  [['II', 'm7'], ['♭II', '7'], ['I', 'maj7'], ['VI', '7']],
  [['IV', 'maj7'], ['IV', 'm7'], ['III', 'm7'], ['VI', '7']],
  [['I', 'maj7'], ['II', '7'], ['II', 'm7'], ['V', '7']],
  [['II', 'm7'], ['V', '7'], ['III', 'm7'], ['VI', '7']],
  [['I', 'maj7'], ['♭VI', '7'], ['V', '7'], ['I', 'maj7']],
  [['III', 'm7'], ['♭III', '7'], ['II', 'm7'], ['♭II', '7']],
  [['I', 'maj7'], ['♭III', '7'], ['♭VI', 'maj7'], ['♭II', '7']],
  [['VII', 'm7b5'], ['III', '7'], ['VI', 'm7'], ['II', '7']]
];
/** Tonalités courantes (jusqu'à 3 altérations) pour les premiers niveaux. */
const COMMON = [0, 5, 7, 10, 2, 3, 9];
export const BASS_LO = 33;
export const BASS_HI = 50;

export interface BassQuestion {
  key: Key;
  degrees: Degree[];
  /** Fondamentale jouée à chaque mesure (MIDI). */
  notes: number[];
  /** Niveau walking : accords et événements (en temps), tempo. */
  chords?: Chord[];
  events?: ArrEvent[];
  tempo: number;
  /** Référence : accord de la tonique (basse + triade). */
  ref: number[];
}

/** Nom d'un degré dans la tonalité (IV en F : B♭). */
export const degreeNote = (key: Key, d: Degree): Note => spellWith(key.tonic.letter + d.letter, pcOf(key.tonic) + d.semis);
export const degreeName = (key: Key, d: Degree) => noteName(degreeNote(key, d));

const weight = (tally: Tally, id: string, pairs: Pair[]) => {
  const it = tally['bass:' + id] ?? { c: 0, t: 0 };
  return (1 + 2 * (1 - (it.c + 1) / (it.t + 2))) * confusionWeight(pairs, id);
};

/** Hauteur de la classe `pc` la plus proche de `near`, dans la tessiture de la contrebasse. */
function nearest(pc: number, near: number) {
  let best = -1;
  for (let m = BASS_LO; m <= BASS_HI; m++) if (mod(m, 12) === pc && (best < 0 || Math.abs(m - near) < Math.abs(best - near) || (Math.abs(m - near) === Math.abs(best - near) && m < best))) best = m;
  return best;
}

function refOf(key: Key): number[] {
  const t = pcOf(key.tonic);
  return [36 + t, ...closeVoicing([t, mod(t + 4, 12), mod(t + 7, 12)], 57)];
}

/** Ligne de 4 fondamentales, sans répéter deux fois de suite la même. */
export function makeBassQuestion(level: number, tally: Tally, pairs: Pair[], rng: Rng = Math.random): BassQuestion {
  const lv = BASS_LEVELS[level] ?? BASS_LEVELS[0];
  if (lv.walking) return makeWalking(tally, pairs, rng);
  const key = keyOnPc(level <= 1 ? pick(COMMON, rng) : rndInt(12, rng), 'major');
  const ids: string[] = [];
  for (let i = 0; i < BASS_NOTES; i++) {
    if (i === 0 && lv.fromTonic) ids.push('I');
    else ids.push(weightedPick(lv.ids.filter((x) => x !== ids[i - 1]), (x) => weight(tally, x, pairs), rng));
  }
  const degrees = ids.map((x) => degreeById(x)!);
  const t = pcOf(key.tonic);
  let prev = 36 + t + (t > 6 ? -12 : 0);
  const notes = degrees.map((d) => (prev = nearest(mod(t + d.semis, 12), prev)));
  return { key, degrees, notes, tempo: 100, ref: refOf(key) };
}

function makeWalking(tally: Tally, pairs: Pair[], rng: Rng): BassQuestion {
  // Les grilles qui contiennent les degrés ratés ou confondus reviennent plus souvent.
  const prog = weightedPick(WALK_PROGS, (p) => p.reduce((s, [id]) => s + weight(tally, id, pairs), 0) / p.length, rng);
  const key = keyOnPc(rndInt(12, rng), 'major');
  const degrees = prog.map(([id]) => degreeById(id)!);
  const chords: Chord[] = prog.map(([id, q]) => ({ root: degreeNote(key, degreeById(id)!), quality: q }));
  const tempo = 112;
  const chart: Chart = {
    id: 'dictee',
    title: 'Dictée',
    key,
    tempo,
    style: 'swing',
    beatsPerBar: 4,
    level: 1,
    bars: chords.map((chord) => ({ chords: [{ chord, beats: 4 }] }))
  };
  const flat = flatten(chart);
  const events = arrangeChorus(chart, flat, [], { bass: false, comp: true, drums: true }, newArrangeState(), rng).filter((e) => e.kind !== 'pos');
  // Basse : toujours la fondamentale sur le 1 (la question porte dessus), puis notes de l'accord et approche.
  const t = pcOf(key.tonic);
  let prev = 36 + t + (t > 6 ? -12 : 0);
  const notes: number[] = [];
  flat.forEach((c, i) => {
    const line = walkingLine(c, flat[(i + 1) % flat.length].chord, prev, true, rng);
    notes.push(line[0]);
    prev = line[line.length - 1];
    line.forEach((midi, k) => events.push({ beat: c.start + k, kind: 'bass', midi, dur: 0.92, vel: k === 0 ? 0.9 : 0.72 }));
  });
  events.sort((a, b) => a.beat - b.beat);
  return { key, degrees, notes, chords, events, tempo, ref: refOf(key) };
}

export interface BassJudgement {
  ok: boolean[];
  /** Pour chaque réponse fausse : où était la vraie note par rapport à la réponse. */
  notes: string[];
  /** Mouvements de la basse, d'une mesure à l'autre. */
  moves: string[];
}

const STEP = ['même note', 'un demi-ton', 'un ton', 'une tierce mineure', 'une tierce majeure', 'une quarte', 'un triton'];

/** Correction : juste ou faux note par note, l'écart quand c'est faux, et les mouvements de la ligne. */
export function judgeBass(q: BassQuestion, given: string[]): BassJudgement {
  const ok = q.degrees.map((d, i) => d.id === given[i]);
  const notes: string[] = [];
  q.degrees.forEach((d, i) => {
    if (ok[i]) return;
    const g = degreeById(given[i]);
    if (!g) return;
    const diff = mod(d.semis - g.semis, 12);
    const up = diff <= 6;
    const n = up ? diff : 12 - diff;
    notes.push(`Mesure ${i + 1} : ${d.id} (${degreeName(q.key, d)}), pas ${g.id} ; ${STEP[n]} ${up ? 'plus haut' : 'plus bas'} que ta réponse.`);
  });
  const moves = q.notes.slice(1).map((m, i) => {
    const d = m - q.notes[i];
    if (!d) return 'même note';
    const iv = INTERVALS.find((x) => x.semis === Math.abs(d));
    return `${iv ? iv.short : Math.abs(d) + ' demi-tons'} ${d > 0 ? '↑' : '↓'}`;
  });
  return { ok, notes, moves };
}

export const chordLine = (q: BassQuestion) => (q.chords ?? []).map(chordSymbol);
