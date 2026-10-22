// Astuces d'enchaînement : comment une note de la main droite passe d'un accord au suivant (elle reste, ou glisse
// d'un demi-ton). Un exemple joué (accords + ligne), transposable dans n'importe quelle tonalité.
import { Key, Mode, keyOnPc } from '../../core/chart/model';
import { Chord, QUALITIES, chordSymbol, degreeLabel, rootPc } from '../../core/theory/chords';
import { Note, mod, noteName, pcOf, spellWith } from '../../core/theory/notes';
import { Step } from '../../core/theory/progressions';

/** Note de la ligne, relative à la fondamentale de l'accord : [lettres au-dessus, demi-tons au-dessus], 'app' : note d'approche (hors de l'accord). */
type Rel = readonly [number, number] | readonly [number, number, 'app'];

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
    title: 'La 7e descend d’un demi-ton',
    rule: 'Dans Dm7 → G7, la 7e de Dm7 (C) descend d’un demi-ton : elle tombe sur B, la 3ce de G7. Sur Cmaj7, B ne bouge pas : il devient la 7e. Une seule note qui glisse, et tout l’enchaînement s’entend.',
    mode: 'major',
    chords: [II, V, I],
    line: [[m7], [M3], [M7]]
  },
  {
    id: '3-7',
    title: 'La note commune ne bouge pas',
    rule: 'F est la 3ce de Dm7 et aussi la 7e de G7 : garde-la. Sur Cmaj7, elle descend d’un demi-ton sur E, la 3ce. Avec l’astuce précédente, tu as les deux notes qui comptent : F et C, puis F et B, puis E et B.',
    mode: 'major',
    chords: [II, V, I],
    line: [[m3], [m7], [M3]]
  },
  {
    id: '5-b9',
    title: 'Vers G7♭9 : trois demi-tons qui descendent',
    rule: 'A est la 5te de Dm7. Descends d’un demi-ton sur G7♭9 : A♭ est sa ♭9 (la 9e baissée, qui assombrit la dominante). Encore un demi-ton : G, la 5te de Cmaj7. A → A♭ → G.',
    mode: 'major',
    chords: [II, [4, 7, '7b9', 'V7♭9'], I],
    line: [[P5], [b9], [P5]]
  },
  {
    id: 'arpege-3',
    title: 'Arpège à partir de la 3ce',
    rule: 'Sur Dm7, commence par la 3ce et monte : F, A, C, E (3ce, 5te, 7e, 9). On entend la 9 sans la fondamentale : ça sonne tout de suite jazz. Puis D et B sur G7 (5te, 3ce), et C pour finir.',
    mode: 'major',
    chords: [II, V, I],
    line: [[m3, P5, m7, M9], [P5, M3], [R]],
    gap: 1.8
  },
  {
    id: 'triton',
    title: 'V → I : les deux notes se resserrent',
    rule: 'Dans G7, B (la 3ce) et F (la 7e) sont à 3 tons l’une de l’autre : un triton, l’intervalle tendu de la dominante. Sur Cmaj7, B monte d’un demi-ton sur C, F descend d’un demi-ton sur E : la tension se relâche.',
    mode: 'major',
    chords: [V, I],
    line: [[m7, M3], [M3, R]],
    together: true,
    gap: 1.6
  },
  {
    id: '13-3',
    title: 'La 13 de G7 annonce le I',
    rule: 'La 13 de G7, c’est E (une 6te au-dessus de G). Or E est la 3ce de Cmaj7. Joue-la sur G7 et garde-la : on entend l’arrivée avant d’y être. Les voicings A et B de G7 (B E F A, F A B E) la contiennent déjà.',
    mode: 'major',
    chords: [[4, 7, '13', 'V13'], I],
    line: [[M13], [M3]],
    gap: 1.6
  },
  {
    id: 'enclosure',
    title: 'Encadrer la note visée',
    rule: 'Pour tomber pile sur E (3ce de Cmaj7) au 1er temps, tourne autour : la note du dessus (F), la note du dessous (D♯), puis E. C’est l’encadrement, partout dans le bebop.',
    mode: 'major',
    chords: [V, I],
    line: [[m7, [4, 8, 'app']], [M3]],
    gap: 1.6
  },
  {
    id: 'approche',
    title: 'Arriver par le demi-ton du dessous',
    rule: 'Toute note de l’accord peut être précédée de la note un demi-ton plus bas, juste avant le temps. Vers B (3ce de G7) : A (5te de Dm7), A♯, puis B.',
    mode: 'major',
    chords: [II, V],
    line: [[P5, [4, 8, 'app']], [M3]],
    gap: 1.6
  },
  {
    id: 'turn-chrom',
    title: 'Turnaround : la ligne monte par demi-tons',
    rule: 'Dans C → A7 → Dm7 → G7, A7 remplace Am7 : sa 3ce, C♯, se glisse entre C et D. La ligne C → C♯ → D monte d’un demi-ton par accord et tire vers Dm7 ; D reste sur G7 (sa 5te).',
    mode: 'major',
    chords: [I, [5, 9, '7', 'V7/II'], II, V],
    line: [[R], [M3], [R], [P5]],
    gap: 1
  },
  {
    id: 'dim-passage',
    title: 'Un °7 entre I et II',
    rule: 'Entre Cmaj7 et Dm7, glisse C♯°7 : la basse monte C → C♯ → D. En haut, E reste (3ce de Cmaj7, puis de C♯°7), monte d’un demi-ton sur F (3ce de Dm7) et reste sur G7 (sa 7e).',
    mode: 'major',
    chords: [I, [0, 1, 'dim7', '♯I°7'], II, V],
    line: [[M3], [m3], [m3], [m7]],
    gap: 1
  },
  {
    id: 'cascade',
    title: 'Dominantes en chaîne : la ligne descend toute seule',
    rule: 'E7 → A7 → D7 → G7 → C : une note sur deux est une 7e, l’autre une 3ce, et à chaque accord elle descend d’un demi-ton. D → C♯ → C → B, puis B reste sur Cmaj7.',
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
    title: 'SubV : la main droite reste, la basse descend',
    rule: 'D♭7 remplace G7 : ils ont les mêmes 3ce et 7e (F et B, écrit C♭ dans D♭7). Dans Dm7 → D♭7 → Cmaj7, garde F en haut puis descends sur E ; la basse fait D → D♭ → C.',
    mode: 'major',
    chords: [II, [1, 1, '7', 'SubV7'], I],
    line: [[m3], [M3], [M3]]
  },
  {
    id: 'mineur-b9',
    title: 'ii–V–i mineur : une note commune, puis un demi-ton',
    rule: 'Dø7 et G7♭9 ont A♭ en commun (la ♭5 de Dø7, la ♭9 de G7♭9). Garde-le sur les deux accords, puis descends d’un demi-ton sur G, la 5te de Cm6.',
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
    title: 'Backdoor : A♭ glisse sur G',
    rule: 'Fm7 → B♭7 → Cmaj7 est une autre façon d’arriver sur le I. A♭, 3ce de Fm7, est aussi la 7e de B♭7 : garde-le. Puis il descend d’un demi-ton sur G, la 5te de C.',
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
    title: 'IV → IVm : la 3ce baisse',
    rule: 'Fmaj7 → Fm6 → Cmaj7 : seule la 3ce de F change, A devient A♭, puis A♭ descend sur G. Cette couleur un peu triste (accord emprunté au mineur) revient souvent en fin de morceau.',
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
  /** En toutes lettres : « 3ce », « 7e », « ♭9 », « approche ». */
  role: string;
  /** Sur le clavier : « 3 », « 7 », « ♭9 »… (vide pour une approche). */
  short: string;
}
export interface RealizedTip {
  key: Key;
  chords: Chord[];
  romans: string[];
  line: TipNote[];
}

const SHORT: Record<string, string> = { '♭3': '3', '♭7': '7', '°7': '7' };
const ROLE: Record<string, string> = { '1': 'fondamentale', '3': '3ce', '5': '5te', '7': '7e', '6': '6te' };
/** Degré comme sur le clavier : la 3ce et la 7e sans altération (celle de l'accord). */
export const shortOf = (degree: string) => SHORT[degree] ?? degree;
/** Degré en toutes lettres, comme dans le texte des astuces. */
export const roleOf = (degree: string) => ROLE[shortOf(degree)] ?? shortOf(degree);

/** Les notes (classes de hauteur) d'un accord. */
export const chordPcs = (c: Chord) => QUALITIES[c.quality].iv.map((i) => mod(rootPc(c) + i, 12));

/** Comment la ligne bouge d'une note à la suivante : « reste », « ↓ ½ ton », « ↑ 1 ton »… */
export function motion(from: number, to: number): string {
  const d = to - from;
  if (d === 0) return 'reste';
  const a = Math.abs(d);
  return `${d < 0 ? '↓' : '↑'} ${a === 1 ? '½ ton' : a === 2 ? '1 ton' : `${a} demi-tons`}`;
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
    for (const [dl, ds, app] of rels) {
      const note = spellWith(c.root.letter + dl, pcOf(c.root) + ds);
      const pc = pcOf(note);
      // Octave la plus proche de la note précédente, dans le registre G4–F6.
      let midi = 67 + mod(pc - 67, 12);
      for (let m = 67; m <= 89; m++) if (mod(m, 12) === pc && Math.abs(m - prev) < Math.abs(midi - prev)) midi = m;
      prev = midi;
      const degree = degreeLabel(c, pc);
      line.push({ chord: ci, note, midi, name: noteName(note), degree, role: app ? 'approche' : roleOf(degree), short: app ? '' : shortOf(degree) });
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
