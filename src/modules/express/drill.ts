// Analyse express : génération de séquences et de questions à réponse rapide.
import { Chart, Key, flatten, keyLabel, keyOnPc } from '../../core/chart/model';
import { Chord, QUALITIES, chordNotes, chordSymbol, rootPc, spellInChord } from '../../core/theory/chords';
import { noteName, pcOf, spellWith } from '../../core/theory/notes';
import { SCALES } from '../../core/theory/scales';
import { PROGRESSIONS, Progression, spellProgression } from '../../core/theory/progressions';
import { guideTones, scaleFor } from '../../core/analysis/improv';
import { analyze } from '../../core/analysis/analyze';
import { patternChoices } from '../../core/analysis/quiz';
import { Rng, pick, shuffle, weightedPick } from '../../core/random';

export type QType = 'degree' | 'pattern' | 'key' | 'nine' | 'tone' | 'scale';
export const QTYPE_LABEL: Record<QType, string> = {
  degree: 'Degrés',
  pattern: 'Enchaînements',
  key: 'Tonalités',
  nine: '9 ou ♭9',
  tone: '3ces et 7es',
  scale: 'Gammes'
};

/** Enchaînements par niveau (cumulatif). */
const LEVEL_OF: Record<string, number> = {
  'I-IV-V': 0, 'I-vi-IV-V': 0, 'I-V-vi-IV': 0, 'I-vi-ii-V': 0, iiVItri: 0,
  iiVI: 1, iiV: 1, turn1: 1, turn3: 1,
  iiVim: 2, iiVm: 2, minTurn: 2,
  sec: 3, subV: 3, back: 3, casc: 3, subVm: 3, I7IV: 3
};
/** Niveaux 0 (débutant, accords de 3 sons) à 3. */
export const LEVELS = [
  { label: 'Débutant', desc: 'Accords de 3 sons (C, Am, F, G…), tonalité affichée' },
  { label: 'N1', desc: 'Majeur, tonalité affichée' },
  { label: 'N2', desc: '+ mineur, 9 ou ♭9' },
  { label: 'N3', desc: '+ substitutions, gammes' }
];
const idsFor = (level: number) => Object.keys(LEVEL_OF).filter((id) => (level === 0 ? LEVEL_OF[id] === 0 : LEVEL_OF[id] >= 1 && LEVEL_OF[id] <= level));

export interface SeqChord {
  chord: Chord;
  roman: string;
}
export interface Seq {
  template: Progression;
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
  /** Réponses aussi acceptées (ex. la gamme alternative). */
  alsoCorrect?: string[];
  explain: string;
}

/** Statistiques par clé (type de question ou enchaînement) : réussites / essais. */
export type Tally = Record<string, { c: number; t: number }>;
const weightOf = (tally: Tally | undefined, k: string) => {
  const it = tally?.[k] ?? { c: 0, t: 0 };
  return 1 + 2 * (1 - (it.c + 1) / (it.t + 2));
};

function withDistractors(answer: string, pool: string[], n: number, rng: Rng, exclude: string[] = []): string[] {
  const others = shuffle([...new Set(pool)].filter((x) => x !== answer && !exclude.includes(x)), rng).slice(0, n);
  return shuffle([answer, ...others], rng);
}

/**
 * Une séquence dans une tonalité au hasard. Les dominantes sont écrites « 7 » sans tension :
 * c'est à l'élève de savoir laquelle colle (question 9 ou ♭9).
 */
export function makeSeq(level: number, rng: Rng = Math.random, templateId?: string, tally?: Tally): Seq {
  const id = templateId ?? weightedPick(idsFor(level), (k) => weightOf(tally, k), rng);
  const t = PROGRESSIONS[id];
  const key = keyOnPc(Math.floor(rng() * 12), t.mode);
  const chords = spellProgression(key, id).map(({ chord, roman }) =>
    chord.quality === '7b9' ? { chord: { ...chord, quality: '7' }, roman: roman.replace('♭9', '') } : { chord, roman }
  );
  return { template: t, key, chords, showKey: level <= 1 };
}

const isMinor = (c: Chord) => ['min', 'hdim', 'dim'].includes(QUALITIES[c.quality].family);
const tonicChord = (k: Key): Chord => ({ root: k.tonic, quality: k.mode === 'minor' ? 'm6' : 'maj7' });
const targetOf = (seq: Seq, i: number): Chord => (i + 1 < seq.chords.length ? seq.chords[i + 1].chord : tonicChord(seq.key));
const familyKey = (c: Chord) => (['m6', 'mM7'].includes(c.quality) ? 'm6' : QUALITIES[c.quality].family);
const romanLineOf = (seq: Seq) => seq.chords.map((c) => c.roman).join(' – ');

const ROMAN_POOL: Record<string, string[]> = {
  min: ['IIm7', 'IIIm7', 'VIm7', 'IVm7', 'Im7', 'Vm7'],
  dom: ['V7', 'V7/II', 'V7/IV', 'V7/V', 'V7/VI', 'SubV7', '♭VII7'],
  maj: ['IΔ7', 'IVΔ7', '♭VIΔ7', '♭IIIΔ7', 'VΔ7'],
  hdim: ['IIø7', 'VIIø7', 'VIø7', '♯IVø7'],
  m6: ['Im6', 'IVm6', 'IIm6', 'Vm6']
};
/** Débutant : degrés des accords de 3 sons. */
const TRIAD_POOL: Record<string, string[]> = {
  maj: ['I', 'IV', 'V', '♭VII', '♭III', '♭VI', 'II'],
  min: ['IIm', 'IIIm', 'VIm', 'IVm', 'Im', 'Vm'],
  dim: ['VII°', '♯IV°', 'II°', '♯I°']
};
const SCALE_POOL: Record<string, string[]> = {
  dom: ['mixolydien', 'mixob9b13', 'alteree', 'lydienb7', 'dimHW'],
  min: ['dorien', 'phrygien', 'eolien', 'melodique', 'lydien'],
  maj: ['ionien', 'lydien', 'mixolydien', 'dorien'],
  hdim: ['locrien', 'locrien9', 'dorien', 'phrygien', 'mixolydien'],
  m6: ['melodique', 'dorien', 'eolien', 'phrygien']
};

function degreeQ(seq: Seq, rng: Rng): Question {
  const i = Math.floor(rng() * seq.chords.length);
  const { chord, roman } = seq.chords[i];
  const sym = chordSymbol(chord);
  return {
    type: 'degree',
    seq,
    focus: i,
    prompt: `Degré de ${sym} ?`,
    choices: withDistractors(roman, TRIAD_POOL[chord.quality] ?? ROMAN_POOL[familyKey(chord)] ?? ROMAN_POOL.dom, 3, rng),
    answer: roman,
    explain: `${sym} = ${roman} en ${keyLabel(seq.key)}. ${seq.template.hint}`
  };
}

function patternQ(seq: Seq, rng: Rng): Question {
  const answer = romanLineOf(seq);
  return {
    type: 'pattern',
    seq,
    prompt: 'Quel enchaînement ?',
    // Mêmes accords lus dans d'autres tonalités : même longueur, mêmes types, seul le chiffrage change.
    choices: patternChoices(
      seq.chords.map((c) => c.chord),
      seq.key,
      answer,
      rng
    ),
    answer,
    explain: `${seq.template.name} en ${keyLabel(seq.key)} : ${seq.chords.map((c) => `${chordSymbol(c.chord)} = ${c.roman}`).join(', ')}. ${seq.template.hint}`
  };
}

function keyQ(seq: Seq, rng: Rng): Question {
  const k = seq.key;
  const pc = pcOf(k.tonic);
  // Même mode que la réponse : le type des accords (m7 ou ø7) ne doit pas suffire à trancher.
  const pool = [5, 7, 2, 10, 3, 9, 1].map((d) => keyLabel(keyOnPc(pc + d, k.mode)));
  const ii = seq.chords.find((c) => c.roman.startsWith('II'));
  const v = seq.chords.find((c) => c.roman === 'V7');
  return {
    type: 'key',
    seq: { ...seq, showKey: false },
    prompt: 'Quelle tonalité ?',
    choices: withDistractors(keyLabel(k), pool, 3, rng),
    answer: keyLabel(k),
    explain: `${chordSymbol(ii!.chord)} – ${chordSymbol(v!.chord)} est le ii–V de ${keyLabel(k)}.${k.mode === 'minor' ? ' Le ø7 signale le mineur.' : ''}`
  };
}

function nineQ(seq: Seq, rng: Rng): Question | null {
  const doms = seq.chords.map((c, i) => ({ c, i })).filter((x) => x.c.chord.quality === '7');
  if (!doms.length) return null;
  const { c, i } = pick(doms, rng);
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
    explain = `${sym} va vers ${chordSymbol(target)}, accord mineur : la ♭9 (${flat9}) appartient à la tonalité visée.`;
  } else {
    answer = '9';
    explain = `${sym} va vers ${chordSymbol(target)}, accord majeur : la 9 naturelle (${nat9}) est dans la tonalité. La ♭9 reste une couleur possible.`;
  }
  return { type: 'nine', seq, focus: i, prompt: `Sur ${sym}, quelle 9 colle à la tonalité visée ?`, choices: ['9', '♭9'], answer, explain };
}

function toneQ(seq: Seq, rng: Rng): Question {
  const i = Math.floor(rng() * seq.chords.length);
  const c = seq.chords[i].chord;
  const sym = chordSymbol(c);
  const g = guideTones(c);
  const askThird = rng() < 0.5;
  const pc = askThird ? g.third : g.seventh;
  const otherPc = askThird ? g.seventh : g.third;
  const triad = /5/.test(g.seventhLabel);
  const label = askThird
    ? g.thirdLabel === '4'
      ? 'Quarte'
      : 'Tierce'
    : triad
      ? 'Quinte'
      : g.seventhLabel === '7'
        ? 'Septième'
        : g.seventhLabel === '6'
          ? 'Sixte'
          : 'Septième diminuée';
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
    explain: triad
      ? `${sym} : ${chordNotes(c).map(noteName).join(' ')}. 3ce = ${spellInChord(c, g.third)}, 5te = ${spellInChord(c, g.seventh)}.`
      : `${sym} : 3ce = ${spellInChord(c, g.third)}, 7e = ${spellInChord(c, g.seventh)}. Ce sont ses guide tones.`
  };
}

function scaleQ(seq: Seq, rng: Rng): Question {
  const i = Math.floor(rng() * seq.chords.length);
  const chords = seq.chords.map((c) => c.chord);
  if (QUALITIES[chords[chords.length - 1].quality].family === 'dom') chords.push(tonicChord(seq.key));
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
  const choice = scaleFor(flatten(chart), analyze(chart), i);
  const c = seq.chords[i].chord;
  const answer = SCALES[choice.scale].name;
  const alt = choice.alt ? SCALES[choice.alt].name : undefined;
  const pool = (SCALE_POOL[familyKey(c)] ?? SCALE_POOL.dom).map((s) => SCALES[s].name);
  return {
    type: 'scale',
    seq,
    focus: i,
    prompt: `Gamme sur ${chordSymbol(c)} ?`,
    // L'alternative n'est jamais proposée comme piège ; si elle sort quand même, elle compte juste.
    choices: withDistractors(answer, pool, 3, rng, alt ? [alt] : []),
    answer,
    alsoCorrect: alt ? [alt] : undefined,
    explain: choice.why + (alt ? ` (${alt} marche aussi.)` : '')
  };
}

const hasIIV = (seq: Seq) => seq.chords.some((c) => c.roman.startsWith('II')) && seq.chords.some((c) => c.roman === 'V7');

/** Une séquence et 3 questions dessus. Les types et enchaînements ratés reviennent plus souvent. */
export function makeRound(level: number, rng: Rng = Math.random, stats: { types?: Tally; templates?: Tally } = {}): Question[] {
  const seq = makeSeq(level, rng, undefined, stats.templates);
  const unresolved = seq.chords.length === 2;
  const qs: Question[] = [degreeQ(seq, rng)];
  qs.push(level >= 2 && hasIIV(seq) && (unresolved || rng() < 0.4) ? keyQ(seq, rng) : patternQ(seq, rng));
  const third: Question[] = [toneQ(seq, rng)];
  if (level >= 2) {
    const n = nineQ(seq, rng);
    if (n) third.push(n);
  }
  if (level >= 3) third.push(scaleQ(seq, rng));
  qs.push(weightedPick(third, (q) => weightOf(stats.types, q.type), rng));
  // La tonalité se demande d'abord : elle ne doit pas être donnée par les questions précédentes.
  return qs.sort((a, b) => (a.type === 'key' ? -1 : b.type === 'key' ? 1 : 0));
}

export const isRight = (q: Question, choice: string) => choice === q.answer || !!q.alsoCorrect?.includes(choice);
