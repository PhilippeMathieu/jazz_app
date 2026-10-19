// Choix de gamme et guide tones, à partir de l'analyse de la grille.
import { Chart, FlatChord, flatten } from '../chart/model';
import { Chord, QUALITIES, chordSymbol, rootPc, spellInChord } from '../theory/chords';
import { mod, pcOf } from '../theory/notes';
import { scalePcs } from '../theory/scales';
import { Analysis, analyze } from './analyze';

export interface ScaleChoice {
  scale: string;
  /** Pourquoi cette gamme, en une phrase. */
  why: string;
  /** Autre gamme possible. */
  alt?: string;
}

const isMinorFamily = (c: Chord) => {
  const f = QUALITIES[c.quality].family;
  return f === 'min' || f === 'hdim' || f === 'dim';
};

export function scaleFor(flat: FlatChord[], an: Analysis, i: number, style: Chart['style'] = 'swing'): ScaleChoice {
  const c = flat[i].chord;
  const a = an.chords[i];
  const q = c.quality;
  const fam = QUALITIES[q].family;
  const keyPc = pcOf(a.key.tonic);
  const deg = mod(rootPc(c) - keyPc, 12);
  const minorKey = a.key.mode === 'minor';
  const target = a.resolvesTo !== undefined ? flat[a.resolvesTo].chord : undefined;
  const sym = chordSymbol(c);

  // Tensions écrites dans le symbole : elles imposent la gamme.
  if (q === '7alt' || q === '7#9') return { scale: 'alteree', why: `${sym} : tensions altérées (♭9 ♯9 ♯11 ♭13) : gamme altérée.`, alt: 'mixob9b13' };
  if (q === '7#11') return { scale: 'lydienb7', why: 'La ♯11 est dans l’accord : lydien ♭7.' };
  if (q === '7b13' || q === '7b9b13') return { scale: 'mixob9b13', why: '♭9 et ♭13 : mixolydien ♭9 ♭13.', alt: 'alteree' };
  if (q === '7#5') return { scale: 'alteree', why: 'Quinte augmentée sur une dominante qui résout : gamme altérée.', alt: 'tons' };
  if (q === '7b5') return { scale: 'lydienb7', why: 'La ♭5 sonne comme une ♯11 : lydien ♭7 (ou gamme par tons).', alt: 'tons' };
  if (q === 'aug') return { scale: 'tons', why: 'Accord augmenté : gamme par tons.' };
  if (q === '7sus4' || q === '9sus4') return { scale: 'mixolydien', why: 'Accord sus : mixolydien, en évitant la tierce.' };
  if (q === 'dim7' || q === 'dim') return { scale: 'dimWH', why: 'Accord diminué : diminuée ton/demi-ton (notes de l’accord + une note un ton au-dessus de chacune).' };
  if (q === 'm6' || q === 'mM7') return { scale: 'melodique', why: 'Tonique mineure avec 6te majeure ou 7e majeure : mineur mélodique.', alt: 'dorien' };
  if (q === 'maj7#11') return { scale: 'lydien', why: 'La ♯11 est dans l’accord : lydien.' };
  if (q === '7b9') {
    if (a.resolution === 'V' && target && !isMinorFamily(target)) return { scale: 'dimHW', why: '7♭9 vers un accord majeur : diminuée demi-ton/ton.', alt: 'mixob9b13' };
    return { scale: 'mixob9b13', why: `${sym} : ♭9, et ♭13 si elle va vers un accord mineur : mixolydien ♭9 ♭13.`, alt: 'dimHW' };
  }

  if (fam === 'hdim') {
    if (a.iiV === 'ii') return { scale: 'locrien', why: 'IIø7 d’un ii–V mineur : locrien. Le locrien ♮2 (9 naturelle) marche aussi.', alt: 'locrien9' };
    return { scale: 'locrien', why: 'Demi-diminué : locrien.', alt: 'locrien9' };
  }

  if (fam === 'maj') {
    if ((!minorKey && deg === 0) || (minorKey && deg === 3)) return { scale: 'ionien', why: 'Tonique majeure : ionien. Évite d’appuyer la 4te (la ♯11 du lydien marche aussi).', alt: 'lydien' };
    return { scale: 'lydien', why: deg === 5 && !minorKey ? 'IVΔ7 : lydien, la ♯4 est diatonique.' : 'Accord majeur hors tonique : lydien.', alt: 'ionien' };
  }

  if (fam === 'min') {
    if (a.iiV === 'ii') return { scale: 'dorien', why: 'II d’un ii–V : dorien.' };
    if (!minorKey && deg === 4) return { scale: 'phrygien', why: 'IIIm7 : phrygien (diatonique). Le dorien est plus courant mais sort de la tonalité.', alt: 'dorien' };
    if (!minorKey && deg === 9) return { scale: 'eolien', why: 'VIm7 : éolien (diatonique).', alt: 'dorien' };
    if (minorKey && deg === 0) return { scale: 'dorien', why: 'Tonique mineure en jazz : dorien (la 6te majeure donne la couleur).', alt: 'eolien' };
    return { scale: 'dorien', why: 'Accord mineur 7 : dorien par défaut.' };
  }

  // Dominantes sans tension écrite
  if (style === 'blues' && !minorKey && (deg === 0 || deg === 5) && a.iiV !== 'V') {
    return { scale: 'mixolydien', why: 'Couleur blues : mixolydien, ou gamme blues de la tonalité.', alt: 'blues' };
  }
  if (a.resolution === 'sub') return { scale: 'lydienb7', why: 'SubV7 : lydien ♭7 (la ♯11 est la fondamentale du V7 remplacé).' };
  if (a.backdoor) return { scale: 'lydienb7', why: 'Backdoor ♭VII7 : lydien ♭7.', alt: 'mixolydien' };
  if (a.resolution === 'V' && target) {
    if (isMinorFamily(target)) return { scale: 'mixob9b13', why: `Résout sur ${chordSymbol(target)}, accord mineur : ♭9 et ♭13 (mixolydien ♭9 ♭13).`, alt: 'alteree' };
    return { scale: 'mixolydien', why: `Résout sur ${chordSymbol(target)}, accord majeur : mixolydien (9 et 13 naturelles).`, alt: 'alteree' };
  }
  return { scale: 'mixolydien', why: 'Dominante qui ne résout pas : mixolydien.', alt: 'lydienb7' };
}

/** 3ce et 7e (ou 6te, 4te selon l'accord), en classes de hauteur. */
export function guideTones(c: Chord): { third: number; seventh: number; thirdLabel: string; seventhLabel: string } {
  const iv = QUALITIES[c.quality].iv;
  const r = rootPc(c);
  const third = iv.includes(4) ? 4 : iv.includes(3) ? 3 : 5;
  const seventh = iv.includes(10) ? 10 : iv.includes(11) ? 11 : iv.includes(9) ? 9 : 10;
  return {
    third: mod(r + third, 12),
    seventh: mod(r + seventh, 12),
    thirdLabel: third === 5 ? '4' : '3',
    seventhLabel: seventh === 9 ? (QUALITIES[c.quality].family === 'dim' ? '°7' : '6') : '7'
  };
}

export interface GuideStep {
  midi: number;
  name: string;
  /** « 3 », « 7 », « 6 »… */
  role: string;
}

/** Choix de notes minimisant le mouvement total (Viterbi) ; `penalty` départage (registre, croisement). */
function smoothest(
  pcs: number[][],
  lo: number,
  hi: number,
  penalty: (i: number, midi: number) => number,
  weight: (i: number) => number
): number[] {
  type Cell = { midi: number; cost: number; from: number };
  const layers: Cell[][] = [];
  pcs.forEach((allowed, i) => {
    const cells: Cell[] = [];
    for (let m = lo; m <= hi; m++) {
      if (!allowed.includes(mod(m, 12))) continue;
      const pull = penalty(i, m);
      if (i === 0) {
        cells.push({ midi: m, cost: pull, from: -1 });
        continue;
      }
      let best = { cost: Infinity, from: -1 };
      layers[i - 1].forEach((p, k) => {
        const c = p.cost + weight(i) * Math.abs(m - p.midi) + pull;
        if (c < best.cost) best = { cost: c, from: k };
      });
      cells.push({ midi: m, ...best });
    }
    layers.push(cells);
  });
  const out: number[] = [];
  let k = layers.length ? layers[layers.length - 1].reduce((bi, c, j, arr) => (c.cost < arr[bi].cost ? j : bi), 0) : -1;
  for (let i = layers.length - 1; i >= 0; i--) {
    out[i] = layers[i][k].midi;
    k = layers[i][k].from;
  }
  return out;
}

/**
 * Les deux lignes de guide tones, comme les deux voix d'un shell : la ligne A part de la 3ce,
 * la ligne B prend toujours l'autre guide tone du même accord (3ce ↔ 7e).
 * Dans un enchaînement de quartes, chaque voix garde la note commune ou descend d'un demi-ton.
 */
function guideLines(chords: Chord[], lo = 57, hi = 76): [GuideStep[], GuideStep[]] {
  if (!chords.length) return [[], []];
  const g = chords.map(guideTones);
  // Changer d'octave sur un accord tenu ne coûte presque rien : c'est là que la ligne remonte.
  // Un saut sur un mouvement de quarte (ii→V→I) coûte plus cher : c'est là que le demi-ton s'entend.
  const weight = (i: number) => {
    if (i === 0) return 1;
    if (chordSymbol(chords[i]) === chordSymbol(chords[i - 1])) return 0.2;
    return mod(rootPc(chords[i]) - rootPc(chords[i - 1]), 12) === 5 ? 1.6 : 1;
  };
  const a = smoothest(
    g.map((x, i) => (i === 0 ? [x.third] : [x.third, x.seventh])),
    lo,
    hi,
    (_, m) => 0.02 * Math.abs(m - 67),
    weight
  );
  const aIsThird = a.map((m, i) => mod(m, 12) === g[i].third);
  const b = smoothest(
    g.map((x, i) => [aIsThird[i] ? x.seventh : x.third]),
    lo - 7,
    hi - 3,
    // la ligne B reste sous la ligne A, à moins d'une octave
    (i, m) => 0.02 * Math.abs(m - 62) + (m > a[i] ? 4 : 0) + (a[i] - m > 12 ? 4 : 0),
    weight
  );
  const step = (c: Chord, x: ReturnType<typeof guideTones>, midi: number): GuideStep => {
    const third = mod(midi, 12) === x.third;
    return { midi, name: spellInChord(c, mod(midi, 12)), role: third ? x.thirdLabel : x.seventhLabel };
  };
  return [a.map((m, i) => step(chords[i], g[i], m)), b.map((m, i) => step(chords[i], g[i], m))];
}

/** Une seule des deux lignes : 'third' = ligne A, 'seventh' = ligne B. */
export function guideLine(chords: Chord[], start: 'third' | 'seventh'): GuideStep[] {
  return guideLines(chords)[start === 'third' ? 0 : 1];
}

export interface ImprovPlan {
  flat: FlatChord[];
  analysis: Analysis;
  scales: ScaleChoice[];
  guideA: GuideStep[];
  guideB: GuideStep[];
}
function guides(chords: Chord[]): { guideA: GuideStep[]; guideB: GuideStep[] } {
  const [guideA, guideB] = guideLines(chords);
  return { guideA, guideB };
}
export function improvPlan(chart: Chart): ImprovPlan {
  const flat = flatten(chart);
  const analysis = analyze(chart);
  const chords = flat.map((f) => f.chord);
  return {
    flat,
    analysis,
    scales: flat.map((_, i) => scaleFor(flat, analysis, i, chart.style)),
    ...guides(chords)
  };
}

export type NoteClass = 'chord' | 'scale' | 'out';

/** Note jouée sur un accord : note de l'accord, autre note de la gamme conseillée, ou hors gamme. */
export function classifyNote(pc: number, c: Chord, scale: string): NoteClass {
  const r = rootPc(c);
  const p = mod(pc, 12);
  if (QUALITIES[c.quality].iv.some((i) => i < 12 && mod(r + i, 12) === p)) return 'chord';
  if (scalePcs(r, scale).includes(p)) return 'scale';
  return 'out';
}

export function isGuideTone(pc: number, c: Chord): boolean {
  const g = guideTones(c);
  const p = mod(pc, 12);
  return p === g.third || p === g.seventh;
}
