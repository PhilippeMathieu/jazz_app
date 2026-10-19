// Choix de gamme et guide tones, à partir de l'analyse de la grille.
import { Chart, FlatChord, flatten } from '../chart/model';
import { Chord, QUALITIES, chordSymbol, rootPc, spellInChord } from '../theory/chords';
import { mod, pcOf } from '../theory/notes';
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
  const next = flat[(i + 1) % flat.length].chord;
  const target = a.resolvesTo !== undefined ? flat[a.resolvesTo].chord : undefined;
  const sym = chordSymbol(c);

  // Qualités qui imposent leur gamme
  if (q === '7alt') return { scale: 'alteree', why: `${sym} : toutes les tensions altérées (♭9 ♯9 ♯11 ♭13).` };
  if (q === '7#11') return { scale: 'lydienb7', why: 'La ♯11 est dans l’accord : lydien ♭7.' };
  if (q === '7#5' || q === '7b5' || q === 'aug') return { scale: 'tons', why: 'Quinte altérée : gamme par tons.' };
  if (q === '7sus4' || q === '9sus4') return { scale: 'mixolydien', why: 'Accord sus : mixolydien, en évitant la tierce.' };
  if (q === 'dim7' || q === 'dim') return { scale: 'dimWH', why: 'Accord diminué : diminuée ton/demi-ton (notes de l’accord + une note un ton au-dessus de chacune).' };
  if (q === 'm6' || q === 'mM7') return { scale: 'melodique', why: 'Tonique mineure avec 6te majeure ou 7e majeure : mineur mélodique.', alt: 'dorien' };
  if (q === 'maj7#11') return { scale: 'lydien', why: 'La ♯11 est dans l’accord : lydien.' };

  if (fam === 'hdim') {
    if (a.iiV === 'ii') return { scale: 'locrien9', why: 'IIø7 d’un ii–V mineur : locrien ♮2 (la 9 naturelle sonne mieux).', alt: 'locrien' };
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

  // Dominantes
  if (style === 'blues' && !minorKey && (deg === 0 || deg === 5) && a.resolution !== 'V') {
    return { scale: 'mixolydien', why: 'Couleur blues : mixolydien, ou gamme blues de la tonalité.', alt: 'blues' };
  }
  if (a.resolution === 'sub') return { scale: 'lydienb7', why: 'SubV7 : lydien ♭7 (la ♯11 est la fondamentale du V7 remplacé).' };
  if (!minorKey && deg === 10 && (rootPc(next) === keyPc || a.roman.startsWith('♭VII'))) return { scale: 'lydienb7', why: 'Backdoor ♭VII7 : lydien ♭7.' };
  if (a.resolution === 'V' && target) {
    if (isMinorFamily(target)) {
      if (q === '7#9') return { scale: 'alteree', why: `Résout sur ${chordSymbol(target)} (mineur) : altérée.`, alt: 'mixob9b13' };
      return { scale: 'mixob9b13', why: `Résout sur ${chordSymbol(target)}, accord mineur : ♭9 et ♭13 (mixolydien ♭9 ♭13).`, alt: 'alteree' };
    }
    if (q === '7b9') return { scale: 'dimHW', why: '7♭9 vers un accord majeur : diminuée demi-ton/ton.', alt: 'alteree' };
    if (q === '7#9') return { scale: 'alteree', why: 'La ♯9 appelle la gamme altérée.' };
    if (q === '7b13') return { scale: 'mixob9b13', why: 'La ♭13 appelle ♭9 ♭13.' };
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

/**
 * Ligne de guide tones : chaque accord prend sa 3ce ou sa 7e, la plus proche de la note précédente.
 * start : 'third' ou 'seventh' pour le premier accord.
 */
export function guideLine(chords: Chord[], start: 'third' | 'seventh', lo = 58, hi = 74): GuideStep[] {
  const out: GuideStep[] = [];
  let prev = -1;
  chords.forEach((c, i) => {
    const g = guideTones(c);
    const options = [
      { pc: g.third, role: g.thirdLabel },
      { pc: g.seventh, role: g.seventhLabel }
    ];
    let best: { midi: number; role: string; pc: number } | null = null;
    const cands = i === 0 ? [start === 'third' ? options[0] : options[1]] : options;
    for (const o of cands) {
      for (let m = lo; m <= hi; m++) {
        if (mod(m, 12) !== o.pc) continue;
        const ref = i === 0 ? (start === 'third' ? 64 : 67) : prev;
        const cost = Math.abs(m - ref) + (i > 0 && m === prev ? 0.5 : 0);
        const bestCost = best ? Math.abs(best.midi - ref) + (i > 0 && best.midi === prev ? 0.5 : 0) : Infinity;
        if (cost < bestCost) best = { midi: m, role: o.role, pc: o.pc };
      }
    }
    prev = best!.midi;
    out.push({ midi: best!.midi, name: spellInChord(c, best!.pc), role: best!.role });
  });
  return out;
}

export interface ImprovPlan {
  flat: FlatChord[];
  analysis: Analysis;
  scales: ScaleChoice[];
  guideA: GuideStep[];
  guideB: GuideStep[];
}
export function improvPlan(chart: Chart): ImprovPlan {
  const flat = flatten(chart);
  const analysis = analyze(chart);
  const chords = flat.map((f) => f.chord);
  return {
    flat,
    analysis,
    scales: flat.map((_, i) => scaleFor(flat, analysis, i, chart.style)),
    guideA: guideLine(chords, 'third'),
    guideB: guideLine(chords, 'seventh')
  };
}
