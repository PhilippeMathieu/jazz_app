// Analyse express : génération de séquences et de questions à réponse rapide.
import { Chart, Key, keyLabel, keyOnPc, Mode } from '../../core/chart/model';
import { Chord, QUALITIES, chordSymbol, rootPc, spellInChord } from '../../core/theory/chords';
import { noteName, pcOf, spellWith } from '../../core/theory/notes';
import { SCALES } from '../../core/theory/scales';
import { guideTones, scaleFor } from '../../core/analysis/improv';
import { analyze } from '../../core/analysis/analyze';
import { flatten } from '../../core/chart/model';

export type QType = 'degree' | 'pattern' | 'key' | 'nine' | 'tone' | 'scale';
export const QTYPE_LABEL: Record<QType, string> = {
  degree: 'Degrés',
  pattern: 'Schémas',
  key: 'Tonalités',
  nine: '9 ou ♭9',
  tone: '3ces et 7es',
  scale: 'Gammes'
};

/** [décalage de lettre, demi-tons, qualité, degré] */
type T = [number, number, string, string];
interface Template {
  id: string;
  name: string;
  mode: Mode;
  chords: T[];
  hint: string;
  level: 1 | 2 | 3;
}

const TEMPLATES: Template[] = [
  { id: 'iiVI', name: 'ii–V–I majeur', mode: 'major', level: 1, chords: [[1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7'], [0, 0, 'maj7', 'IΔ7']], hint: 'Basse en quartes montantes : II → V → I.' },
  { id: 'iiV', name: 'ii–V majeur (sans le I)', mode: 'major', level: 1, chords: [[1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], hint: 'm7 puis 7 une quarte plus haut : la tonalité est une quarte au-dessus du V7.' },
  { id: 'turn1', name: 'Turnaround I–VI–II–V', mode: 'major', level: 1, chords: [[0, 0, 'maj7', 'IΔ7'], [5, 9, 'm7', 'VIm7'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], hint: 'Ramène vers le I : la basse descend d’une tierce puis monte en quartes.' },
  { id: 'turn3', name: 'Turnaround III–VI–II–V', mode: 'major', level: 1, chords: [[2, 4, 'm7', 'IIIm7'], [5, 9, 'm7', 'VIm7'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], hint: 'Le IIIm7 remplace le I : trois m7 puis le V7, tout en quartes.' },
  { id: 'iiVim', name: 'ii–V–i mineur', mode: 'minor', level: 2, chords: [[1, 2, 'm7b5', 'IIø7'], [4, 7, '7', 'V7'], [0, 0, 'm6', 'Im6']], hint: 'ø7 puis 7 : signature du mineur.' },
  { id: 'iiVm', name: 'ii–V mineur (sans le i)', mode: 'minor', level: 2, chords: [[1, 2, 'm7b5', 'IIø7'], [4, 7, '7', 'V7']], hint: 'Le ø7 annonce une tonique mineure une quarte au-dessus du V7.' },
  { id: 'minTurn', name: 'Turnaround mineur', mode: 'minor', level: 2, chords: [[0, 0, 'm7', 'Im7'], [3, 5, 'm7', 'IVm7'], [1, 2, 'm7b5', 'IIø7'], [4, 7, '7', 'V7']], hint: 'Tonique mineure, IV mineur, puis ii–V mineur.' },
  { id: 'sec', name: 'Dominante secondaire', mode: 'major', level: 3, chords: [[0, 0, 'maj7', 'IΔ7'], [5, 9, '7', 'V7/II'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], hint: 'Le VI devient 7 : il est le V7 du II.' },
  { id: 'subV', name: 'ii–SubV–I', mode: 'major', level: 3, chords: [[1, 2, 'm7', 'IIm7'], [1, 1, '7', 'SubV7'], [0, 0, 'maj7', 'IΔ7']], hint: 'Basse chromatique descendante : le SubV7 remplace le V7 (même triton).' },
  { id: 'back', name: 'Backdoor', mode: 'major', level: 3, chords: [[3, 5, 'm7', 'IVm7'], [6, 10, '7', '♭VII7'], [0, 0, 'maj7', 'IΔ7']], hint: 'Arrivée sur le I par le ♭VII7, un ton en dessous.' },
  { id: 'casc', name: 'ii–V en cascade', mode: 'major', level: 3, chords: [[2, 4, 'm7', 'IIIm7'], [5, 9, '7', 'V7/II'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7'], [0, 0, 'maj7', 'IΔ7']], hint: 'Un ii–V vers le II, puis un ii–V vers le I.' },
  { id: 'subVm', name: 'ii–SubV–i mineur', mode: 'minor', level: 3, chords: [[1, 2, 'm7b5', 'IIø7'], [1, 1, '7', 'SubV7'], [0, 0, 'm6', 'Im6']], hint: 'ii–V–i mineur avec le SubV7 à la place du V7.' },
  { id: 'I7IV', name: 'I7 vers le IV', mode: 'major', level: 3, chords: [[0, 0, 'maj7', 'IΔ7'], [0, 0, '7', 'V7/IV'], [3, 5, 'maj7', 'IVΔ7'], [3, 5, 'm6', 'IVm6']], hint: 'Le I devient 7 pour aller au IV, puis IV mineur emprunté.' }
];

export const LEVELS = [
  { label: 'N1', desc: 'Majeur : ii–V–I, turnarounds' },
  { label: 'N2', desc: '+ mineur, 9 ou ♭9, tonalité cachée' },
  { label: 'N3', desc: '+ secondaires, SubV, backdoor, gammes' }
];

export interface SeqChord {
  chord: Chord;
  roman: string;
}
export interface Seq {
  template: Template;
  key: Key;
  chords: SeqChord[];
  showKey: boolean;
}
export interface Question {
  type: QType;
  seq: Seq;
  focus?: number;
  prompt: string;
  choices: string[];
  answer: string;
  explain: string;
}

type Rng = () => number;
const pickOne = <T,>(a: T[], rng: Rng) => a[Math.floor(rng() * a.length)];
function shuffle<T>(a: T[], rng: Rng): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function withDistractors(answer: string, pool: string[], n: number, rng: Rng): string[] {
  const others = shuffle(
    [...new Set(pool)].filter((x) => x !== answer),
    rng
  ).slice(0, n);
  return shuffle([answer, ...others], rng);
}

export function makeSeq(level: number, rng: Rng = Math.random, templateId?: string): Seq {
  const pool = TEMPLATES.filter((t) => t.level <= level);
  const t = templateId ? TEMPLATES.find((x) => x.id === templateId)! : pickOne(pool, rng);
  const key = keyOnPc(Math.floor(rng() * 12), t.mode);
  const kpc = pcOf(key.tonic);
  const chords = t.chords.map(([off, semis, q, roman]) => ({
    chord: { root: spellWith(key.tonic.letter + off, kpc + semis), quality: q },
    roman
  }));
  return { template: t, key, chords, showKey: level === 1 };
}

const isMinor = (c: Chord) => ['min', 'hdim', 'dim'].includes(QUALITIES[c.quality].family);
const tonicChord = (k: Key): Chord => ({ root: k.tonic, quality: k.mode === 'minor' ? 'm6' : 'maj7' });

/** Cible d'un accord : l'accord suivant, ou la tonique implicite en fin de séquence. */
function targetOf(seq: Seq, i: number): Chord {
  return i + 1 < seq.chords.length ? seq.chords[i + 1].chord : tonicChord(seq.key);
}

const ROMAN_POOL: Record<string, string[]> = {
  min: ['IIm7', 'IIIm7', 'VIm7', 'IVm7', 'Im7', 'Vm7'],
  dom: ['V7', 'V7/II', 'V7/IV', 'V7/V', 'V7/VI', 'SubV7', '♭VII7'],
  maj: ['IΔ7', 'IVΔ7', '♭VIΔ7', '♭IIIΔ7', 'VΔ7'],
  hdim: ['IIø7', 'VIIø7', 'VIø7', '♯IVø7'],
  m6: ['Im6', 'IVm6', 'IIm6', 'Vm6']
};
const SCALE_POOL: Record<string, string[]> = {
  dom: ['mixolydien', 'mixob9b13', 'alteree', 'lydienb7', 'dimHW'],
  min: ['dorien', 'phrygien', 'eolien', 'melodique'],
  maj: ['ionien', 'lydien', 'mixolydien'],
  hdim: ['locrien', 'locrien9', 'dorien'],
  m6: ['melodique', 'dorien', 'eolien', 'phrygien']
};
const familyKey = (c: Chord) => (['m6', 'mM7'].includes(c.quality) ? 'm6' : QUALITIES[c.quality].family);

function degreeQ(seq: Seq, rng: Rng): Question {
  const i = Math.floor(rng() * seq.chords.length);
  const { chord, roman } = seq.chords[i];
  const sym = chordSymbol(chord);
  return {
    type: 'degree',
    seq,
    focus: i,
    prompt: `Degré de ${sym} ?`,
    choices: withDistractors(roman, ROMAN_POOL[familyKey(chord)] ?? ROMAN_POOL.dom, 3, rng),
    answer: roman,
    explain: `${sym} = ${roman} en ${keyLabel(seq.key)}. ${seq.template.hint}`
  };
}

function patternQ(seq: Seq, level: number, rng: Rng): Question {
  const pool = TEMPLATES.filter((t) => t.level <= level).map((t) => t.name);
  return {
    type: 'pattern',
    seq,
    prompt: 'Quel schéma ?',
    choices: withDistractors(seq.template.name, pool, 3, rng),
    answer: seq.template.name,
    explain: `${seq.chords.map((c) => c.roman).join(' – ')}. ${seq.template.hint}`
  };
}

function keyQ(seq: Seq, rng: Rng): Question {
  const k = seq.key;
  const pc = pcOf(k.tonic);
  const other: Mode = k.mode === 'major' ? 'minor' : 'major';
  const relative = keyOnPc(k.mode === 'major' ? pc + 9 : pc + 3, other);
  const pool = [relative, keyOnPc(pc + 7, k.mode), keyOnPc(pc + 5, k.mode), keyOnPc(pc, other), keyOnPc(pc + 2, k.mode)].map(keyLabel);
  const ii = seq.chords.find((c) => c.roman.startsWith('II'));
  const v = seq.chords.find((c) => c.roman === 'V7');
  const how = ii && v ? `${chordSymbol(ii.chord)} – ${chordSymbol(v.chord)} est le ii–V de ${keyLabel(k)}.` : seq.template.hint;
  return {
    type: 'key',
    seq: { ...seq, showKey: false },
    prompt: 'Quelle tonalité ?',
    choices: withDistractors(keyLabel(k), pool, 3, rng),
    answer: keyLabel(k),
    explain: how + (k.mode === 'minor' ? ' Le ø7 signale le mineur.' : '')
  };
}

function nineQ(seq: Seq, rng: Rng): Question | null {
  const doms = seq.chords.map((c, i) => ({ c, i })).filter((x) => x.c.chord.quality === '7');
  if (!doms.length) return null;
  const { c, i } = pickOne(doms, rng);
  const sym = chordSymbol(c.chord);
  const target = targetOf(seq, i);
  const r = rootPc(c.chord);
  const flat9 = spellInChord(c.chord, r + 1);
  const nat9 = spellInChord(c.chord, r + 2);
  let answer: string;
  let explain: string;
  if (c.roman.startsWith('SubV') || c.roman.startsWith('♭VII')) {
    answer = '9';
    explain = `${sym} est un ${c.roman} : lydien ♭7, 9 naturelle (${nat9}).`;
  } else if (isMinor(target)) {
    answer = '♭9';
    explain = `${sym} va vers ${chordSymbol(target)}, accord mineur : ♭9 (${flat9}). Elle appartient à la tonalité mineure visée.`;
  } else {
    answer = '9';
    explain = `${sym} va vers ${chordSymbol(target)}, accord majeur : 9 naturelle (${nat9}). La ♭9 reste possible comme couleur altérée.`;
  }
  return { type: 'nine', seq, focus: i, prompt: `Sur ${sym} : 9 ou ♭9 ?`, choices: ['9', '♭9'], answer, explain };
}

function toneQ(seq: Seq, rng: Rng): Question {
  const i = Math.floor(rng() * seq.chords.length);
  const c = seq.chords[i].chord;
  const sym = chordSymbol(c);
  const g = guideTones(c);
  const askThird = rng() < 0.5;
  const pc = askThird ? g.third : g.seventh;
  const otherPc = askThird ? g.seventh : g.third;
  const label = askThird ? (g.thirdLabel === '4' ? 'Quarte' : 'Tierce') : g.seventhLabel === '7' ? 'Septième' : g.seventhLabel === '6' ? 'Sixte' : 'Septième diminuée';
  const answer = spellInChord(c, pc);
  const letter = 'CDEFGAB'.indexOf(answer[0]);
  const near = [-1, 1].map((d) => noteName(spellWith(letter, pc + d)));
  const fifth = spellInChord(c, rootPc(c) + (QUALITIES[c.quality].iv.includes(6) ? 6 : 7));
  const pool = [...near, spellInChord(c, otherPc), fifth, noteName(c.root)].filter((n) => !/[𝄫𝄪]/.test(n));
  return {
    type: 'tone',
    seq,
    focus: i,
    prompt: `${label} de ${sym} ?`,
    choices: withDistractors(answer, pool, 3, rng),
    answer,
    explain: `${sym} : 3 = ${spellInChord(c, g.third)}, 7 = ${spellInChord(c, g.seventh)}. Ce sont ses guide tones.`
  };
}

function scaleQ(seq: Seq, rng: Rng): Question {
  const i = Math.floor(rng() * seq.chords.length);
  const chords = seq.chords.map((c) => c.chord);
  const last = chords[chords.length - 1];
  if (QUALITIES[last.quality].family === 'dom') chords.push(tonicChord(seq.key));
  const chart: Chart = {
    id: 'drill',
    title: '',
    key: seq.key,
    tempo: 120,
    style: 'swing',
    beatsPerBar: 4,
    level: 1,
    bars: chords.map((c) => ({ chords: [{ chord: c, beats: 4 }] }))
  };
  const flat = flatten(chart);
  const choice = scaleFor(flat, analyze(chart), i);
  const c = seq.chords[i].chord;
  const answer = SCALES[choice.scale].name;
  const pool = (SCALE_POOL[familyKey(c)] ?? SCALE_POOL.dom).map((s) => SCALES[s].name);
  return {
    type: 'scale',
    seq,
    focus: i,
    prompt: `Gamme sur ${chordSymbol(c)} ?`,
    choices: withDistractors(answer, pool, 3, rng),
    answer,
    explain: choice.why
  };
}

/** Une séquence et 3 questions dessus. */
export function makeRound(level: number, rng: Rng = Math.random): Question[] {
  const seq = makeSeq(level, rng);
  const qs: Question[] = [degreeQ(seq, rng)];
  const unresolved = QUALITIES[seq.chords[seq.chords.length - 1].chord.quality].family === 'dom' && seq.chords.length === 2;
  qs.push(level >= 2 && (unresolved || rng() < 0.4) ? keyQ(seq, rng) : patternQ(seq, level, rng));
  const third: (Question | null)[] = [toneQ(seq, rng)];
  if (level >= 2) third.push(nineQ(seq, rng), nineQ(seq, rng));
  if (level >= 3) third.push(scaleQ(seq, rng), scaleQ(seq, rng));
  const ok = third.filter((q): q is Question => q !== null);
  qs.push(pickOne(ok, rng));
  // La question de tonalité se pose avant les autres : elle ne doit pas être donnée par l'affichage.
  return qs.sort((a, b) => (a.type === 'key' ? -1 : b.type === 'key' ? 1 : 0));
}

export const allTemplates = TEMPLATES;
