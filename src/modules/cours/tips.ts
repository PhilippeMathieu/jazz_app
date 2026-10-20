// Astuces d'enchaînement : une règle de conduite des voix, un exemple joué (accords + ligne de main droite),
// transposable dans n'importe quelle tonalité.
import { Key, Mode, keyOnPc } from '../../core/chart/model';
import { Chord, chordSymbol, degreeLabel } from '../../core/theory/chords';
import { Note, mod, noteName, pcOf, spellWith } from '../../core/theory/notes';
import { Step } from '../../core/theory/progressions';

/** Note de la ligne, relative à la fondamentale de l'accord : [lettres au-dessus, demi-tons au-dessus]. */
type Rel = [number, number];

export interface Tip {
  id: string;
  title: string;
  rule: string;
  mode: Mode;
  chords: Step[];
  /** Notes de la ligne, accord par accord (une ou plusieurs). */
  line: Rel[][];
  /** Les notes d'un même accord sonnent ensemble (deux voix) au lieu de se suivre. */
  together?: boolean;
  gap?: number;
}

const II: Step = [1, 2, 'm7', 'IIm7'];
const V: Step = [4, 7, '7', 'V7'];
const I: Step = [0, 0, 'maj7', 'IΔ7'];

// Intervalles usuels depuis la fondamentale de l'accord.
const R: Rel = [0, 0];
const m3: Rel = [2, 3];
const M3: Rel = [2, 4];
const P5: Rel = [4, 7];
const b5: Rel = [4, 6];
const m7: Rel = [6, 10];
const M7: Rel = [6, 11];
const M9: Rel = [1, 14];
const b9: Rel = [1, 13];
const M13: Rel = [5, 21];

export const TIPS: Tip[] = [
  {
    id: '7-3',
    title: 'II → V : la 7e descend sur la 3ce',
    rule: 'La 7e du II descend d’un demi-ton sur la 3ce du V (C → B dans Dm7 → G7). Puis la 3ce du V reste : elle devient la 7e du IΔ7. Vise ces notes sur le 1er temps : l’enchaînement s’entend sans la basse.',
    mode: 'major',
    chords: [II, V, I],
    line: [[m7], [M3], [M7]]
  },
  {
    id: '3-7',
    title: 'II → V : la 3ce reste et devient la 7e',
    rule: 'Note commune : la 3ce du II (F dans Dm7) est la 7e du V (G7). Garde-la, puis descends d’un demi-ton sur la 3ce du I (E). C’est l’autre voix du shell.',
    mode: 'major',
    chords: [II, V, I],
    line: [[m3], [m7], [M3]]
  },
  {
    id: '5-b9',
    title: 'II → V : la 5te du II descend sur la ♭9 du V',
    rule: 'Vise la 5te du II (A dans Dm7), descends d’un demi-ton en arrivant sur le V : tu tombes sur sa ♭9 (A♭ dans G7♭9). Encore un demi-ton et tu es sur la 5te du I (G). Ligne chromatique A – A♭ – G, très « bebop ».',
    mode: 'major',
    chords: [II, [4, 7, '7b9', 'V7♭9'], I],
    line: [[P5], [b9], [P5]]
  },
  {
    id: 'arpege-3',
    title: 'Commencer le II sur sa 3ce : arpège 3-5-7-9',
    rule: 'Sur un m7, arpège à partir de la 3ce : F A C E sur Dm7 (un Fmaj7 posé sur D). On entend la 9 tout de suite, sans la fondamentale. La phrase redescend ensuite vers la 3ce du V (B).',
    mode: 'major',
    chords: [II, V, I],
    line: [[m3, P5, m7, M9], [P5, M3], [R]],
    gap: 1.8
  },
  {
    id: 'triton',
    title: 'V → I : le triton se referme',
    rule: 'La 3ce et la 7e du V forment un triton (B–F dans G7). Il se résout en se refermant : B monte sur C, F descend sur E. Deux demi-tons et toute la tension part.',
    mode: 'major',
    chords: [V, I],
    line: [[m7, M3], [M3, R]],
    together: true,
    gap: 1.6
  },
  {
    id: '13-3',
    title: 'V → I : la 13 annonce la 3ce',
    rule: 'Sur G7, la 13 (E) est déjà la 3ce de C. Joue-la sur le V et garde-la : la résolution s’entend avant l’accord.',
    mode: 'major',
    chords: [[4, 7, '13', 'V13'], I],
    line: [[M13], [M3]],
    gap: 1.6
  },
  {
    id: 'enclosure',
    title: 'Encadrer la note visée',
    rule: 'Pour tomber sur une note de l’accord au 1er temps, entoure-la : un demi-ton au-dessus, un demi-ton en dessous, puis la note. Vers E (3ce de Cmaj7) : F – D♯ – E.',
    mode: 'major',
    chords: [V, I],
    line: [[m7, [4, 8]], [M3]],
    gap: 1.6
  },
  {
    id: 'approche',
    title: 'Approche chromatique par en dessous',
    rule: 'Toute note de l’accord peut être précédée de la note un demi-ton plus bas, sur le contretemps. Vers B (3ce de G7) : A – A♯ – B.',
    mode: 'major',
    chords: [II, V],
    line: [[P5, [4, 8]], [M3]],
    gap: 1.6
  },
  {
    id: 'turn-chrom',
    title: 'Turnaround : C – C♯ – D',
    rule: 'Quand le VI devient 7 (A7, V7/II), sa 3ce (C♯) est la sensible du II. Ligne : tonique, C♯, D. Un demi-ton par accord.',
    mode: 'major',
    chords: [I, [5, 9, '7', 'V7/II'], II, V],
    line: [[R], [M3], [R], [P5]],
    gap: 1
  },
  {
    id: 'dim-passage',
    title: '°7 de passage entre I et II',
    rule: 'Entre Cmaj7 et Dm7, glisse C♯°7 : la basse monte par demi-tons (C – C♯ – D). C♯°7, c’est A7♭9 sans fondamentale : la dominante du II.',
    mode: 'major',
    chords: [I, [0, 1, 'dim7', '♯I°7'], II, V],
    line: [[M3], [m3], [m3], [m7]],
    gap: 1
  },
  {
    id: 'cascade',
    title: 'Dominantes en cascade : une ligne qui descend seule',
    rule: 'E7 A7 D7 G7 : la 7e de chaque accord descend d’un demi-ton sur la 3ce du suivant, et la 3ce devient la 7e. Ligne D – C♯ – C – B.',
    mode: 'major',
    chords: [
      [2, 4, '7', 'V7/VI'],
      [5, 9, '7', 'V7/II'],
      [1, 2, '7', 'V7/V'],
      [4, 7, '7', 'V7'],
      I
    ],
    line: [[m7], [M3], [m7], [M3], [M7]],
    gap: 1
  },
  {
    id: 'subv',
    title: 'SubV : garde la main droite, change la basse',
    rule: 'D♭7 a les mêmes 3ce et 7e que G7 (F et C♭ = B). Dans Dm7 → D♭7 → Cmaj7, garde F, puis descends sur E ; la basse descend D – D♭ – C.',
    mode: 'major',
    chords: [II, [1, 1, '7', 'SubV7'], I],
    line: [[m3], [M3], [M3]]
  },
  {
    id: 'mineur-b9',
    title: 'ii–V–i mineur : la ♭5 du II reste, c’est la ♭9 du V',
    rule: 'Dø7 et G7♭9 partagent A♭ : ♭5 du II, ♭9 du V. Garde-le, puis descends sur G, la 5te de Cm.',
    mode: 'minor',
    chords: [
      [1, 2, 'm7b5', 'IIø7'],
      [4, 7, '7b9', 'V7♭9'],
      [0, 0, 'm6', 'Im6']
    ],
    line: [[b5], [b9], [P5]]
  },
  {
    id: 'backdoor',
    title: 'Backdoor : la 3ce du IVm glisse sur la 5te du I',
    rule: 'Fm7 → B♭7 → Cmaj7 : A♭ (3ce de Fm7) reste sur B♭7 (sa 7e), puis descend d’un demi-ton sur G, la 5te de C.',
    mode: 'major',
    chords: [
      [3, 5, 'm7', 'IVm7'],
      [6, 10, '7', '♭VII7'],
      I
    ],
    line: [[m3], [m7], [P5]]
  },
  {
    id: 'iv-ivm',
    title: 'IV → IVm : la 3ce descend',
    rule: 'Fmaj7 → Fm6 → Cmaj7 : A descend sur A♭, puis sur G. La couleur mélancolique de l’emprunt au mineur, très utilisée en fin de phrase.',
    mode: 'major',
    chords: [
      [3, 5, 'maj7', 'IVΔ7'],
      [3, 5, 'm6', 'IVm6'],
      I
    ],
    line: [[M3], [m3], [P5]]
  }
];

export interface TipNote {
  chord: number;
  note: Note;
  midi: number;
  name: string;
  /** Degré dans l'accord : « 3 », « ♭9 », « 13 »… */
  degree: string;
}
export interface RealizedTip {
  key: Key;
  chords: Chord[];
  romans: string[];
  line: TipNote[];
}

/** L'exemple d'une astuce dans une tonalité : accords, ligne orthographiée et placée (registre de main droite). */
export function realize(tip: Tip, keyPc: number): RealizedTip {
  const key = keyOnPc(keyPc, tip.mode);
  const t = pcOf(key.tonic);
  const chords: Chord[] = tip.chords.map(([off, semis, quality]) => ({ root: spellWith(key.tonic.letter + off, t + semis), quality }));
  const line: TipNote[] = [];
  let prev = 71;
  tip.line.forEach((rels, ci) => {
    const c = chords[ci];
    for (const [dl, ds] of rels) {
      const note = spellWith(c.root.letter + dl, pcOf(c.root) + ds);
      const pc = pcOf(note);
      // Octave la plus proche de la note précédente, dans le registre G4–F6.
      let midi = 67 + mod(pc - 67, 12);
      for (let m = 67; m <= 89; m++) if (mod(m, 12) === pc && Math.abs(m - prev) < Math.abs(midi - prev)) midi = m;
      prev = midi;
      line.push({ chord: ci, note, midi, name: noteName(note), degree: degreeLabel(c, pc) });
    }
  });
  return { key, chords, romans: tip.chords.map((s) => s[3]), line };
}

/** Tonalité sans double altération pour cet exemple (au hasard, différente de la précédente). */
export function anotherKey(tip: Tip, current: number, rng: () => number = Math.random): number {
  const ok = Array.from({ length: 12 }, (_, pc) => pc).filter((pc) => {
    if (pc === current) return false;
    const r = realize(tip, pc);
    const names = [...r.chords.map(chordSymbol), ...r.line.map((n) => n.name)].join(' ');
    return !/[𝄫𝄪]/.test(names);
  });
  return ok[Math.floor(rng() * ok.length)] ?? current;
}
