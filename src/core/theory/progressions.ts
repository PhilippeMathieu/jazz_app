// Enchaînements types, partagés par l'Analyse express, l'Oreille et Flash voicings.
import { Key, Mode, keyOnPc } from '../chart/model';
import { Chord } from './chords';
import { pcOf, spellWith } from './notes';

/** [décalage de lettre depuis la tonique, demi-tons depuis la tonique, qualité, degré] */
export type Step = [number, number, string, string];

export interface Progression {
  id: string;
  name: string;
  mode: Mode;
  steps: Step[];
  hint: string;
}

const P = (id: string, name: string, mode: Mode, steps: Step[], hint: string): Progression => ({ id, name, mode, steps, hint });

export const PROGRESSIONS: Record<string, Progression> = Object.fromEntries(
  [
    P('iiVI', 'ii–V–I majeur', 'major', [[1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7'], [0, 0, 'maj7', 'IΔ7']], 'La cadence de base : la basse monte de quarte, II → V → I.'),
    P('iiV', 'ii–V sans résolution', 'major', [[1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], 'm7 puis 7 une quarte plus haut : la tonique est une quarte au-dessus du V7.'),
    P('turn1', 'Turnaround I–VI–II–V', 'major', [[0, 0, 'maj7', 'IΔ7'], [5, 9, 'm7', 'VIm7'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], 'Ramène vers le I en fin de grille.'),
    P('turn3', 'Turnaround III–VI–II–V', 'major', [[2, 4, 'm7', 'IIIm7'], [5, 9, 'm7', 'VIm7'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], 'Le IIIm7 remplace le I (deux notes communes) ; tout en quartes.'),
    P('IVii', 'Passage par le IV', 'major', [[0, 0, 'maj7', 'IΔ7'], [3, 5, 'maj7', 'IVΔ7'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], 'Sous-dominante, puis cadence ii–V.'),
    P('iiVim', 'ii–V–i mineur', 'minor', [[1, 2, 'm7b5', 'IIø7'], [4, 7, '7b9', 'V7♭9'], [0, 0, 'm6', 'Im6']], 'ø7 puis 7♭9 : la signature du mineur.'),
    P('iiVm', 'ii–V mineur sans résolution', 'minor', [[1, 2, 'm7b5', 'IIø7'], [4, 7, '7b9', 'V7♭9']], 'Le ø7 annonce une tonique mineure une quarte au-dessus du V7.'),
    P('minTurn', 'Turnaround mineur', 'minor', [[0, 0, 'm7', 'Im7'], [3, 5, 'm7', 'IVm7'], [1, 2, 'm7b5', 'IIø7'], [4, 7, '7b9', 'V7♭9']], 'Tonique mineure, IV mineur, puis ii–V mineur.'),
    P('sec', 'Dominante secondaire', 'major', [[0, 0, 'maj7', 'IΔ7'], [5, 9, '7', 'V7/II'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], 'Le VI devient 7 : c’est le V7 du II, qu’il prépare.'),
    P('I7IV', 'I7 vers le IV', 'major', [[0, 0, 'maj7', 'IΔ7'], [0, 0, '7', 'V7/IV'], [3, 5, 'maj7', 'IVΔ7'], [3, 5, 'm6', 'IVm6']], 'Le I devient 7 pour aller au IV, puis IV mineur emprunté.'),
    P('subV', 'Substitution tritonique', 'major', [[1, 2, 'm7', 'IIm7'], [1, 1, '7', 'SubV7'], [0, 0, 'maj7', 'IΔ7']], 'Le SubV7 remplace le V7 (même triton) : basse chromatique descendante.'),
    P('back', 'Backdoor', 'major', [[3, 5, 'm7', 'IVm7'], [6, 10, '7', '♭VII7'], [0, 0, 'maj7', 'IΔ7']], 'Arrivée sur le I par le ♭VII7, emprunté au mineur.'),
    P('bridge', 'Pont des rhythm changes', 'major', [[2, 4, '7', 'V7/VI'], [5, 9, '7', 'V7/II'], [1, 2, '7', 'V7/V'], [4, 7, '7', 'V7']], 'Chaîne de dominantes en quartes : chaque 7 résout sur la suivante.'),
    P('dimp', 'Diminué de passage', 'major', [[0, 0, 'maj7', 'IΔ7'], [0, 1, 'dim7', '♯I°7'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], 'Le °7 relie I et II par une basse chromatique montante.'),
    P('casc', 'ii–V en cascade', 'major', [[2, 4, 'm7', 'IIIm7'], [5, 9, '7', 'V7/II'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7'], [0, 0, 'maj7', 'IΔ7']], 'Un ii–V vers le II, puis un ii–V vers le I.'),
    P('subVm', 'Sub. tritonique en mineur', 'minor', [[1, 2, 'm7b5', 'IIø7'], [1, 1, '7', 'SubV7'], [0, 0, 'm6', 'Im6']], 'ii–V–i mineur avec le SubV7 à la place du V7.'),
    // Accords de 3 sons (niveau débutant)
    P('I-IV-V', 'I – IV – V – I', 'major', [[0, 0, 'maj', 'I'], [3, 5, 'maj', 'IV'], [4, 7, 'maj', 'V'], [0, 0, 'maj', 'I']], 'Les trois accords majeurs de la gamme : tonique, sous-dominante, dominante. Le V ramène au I.'),
    P('I-vi-IV-V', 'I – VI – IV – V', 'major', [[0, 0, 'maj', 'I'], [5, 9, 'min', 'VIm'], [3, 5, 'maj', 'IV'], [4, 7, 'maj', 'V']], 'Tonique, relatif mineur, IV, V : la boucle des années 50.'),
    P('I-V-vi-IV', 'I – V – VI – IV', 'major', [[0, 0, 'maj', 'I'], [4, 7, 'maj', 'V'], [5, 9, 'min', 'VIm'], [3, 5, 'maj', 'IV']], 'La boucle pop la plus jouée : le mineur (VIm) arrive en 3e position, après le V.'),
    P('vi-IV-I-V', 'VI – IV – I – V', 'major', [[5, 9, 'min', 'VIm'], [3, 5, 'maj', 'IV'], [0, 0, 'maj', 'I'], [4, 7, 'maj', 'V']], 'Les accords de I – V – VI – IV, mais on part du mineur : plus sombre, le I n’arrive qu’en 3e position.'),
    // Deux accords : depuis le I, où va-t-on ? (pour apprendre à reconnaître une suite, un accord à la fois)
    P('I-IV', 'I → IV', 'major', [[0, 0, 'maj', 'I'], [3, 5, 'maj', 'IV']], 'La basse monte de 4 notes (C → F). Le IV est doux, ouvert : on s’éloigne sans tension.'),
    P('I-V', 'I → V', 'major', [[0, 0, 'maj', 'I'], [4, 7, 'maj', 'V']], 'La basse monte de 5 notes (C → G). Le V est tendu : il attend de revenir au I.'),
    P('I-vi', 'I → VIm', 'major', [[0, 0, 'maj', 'I'], [5, 9, 'min', 'VIm']], 'Le seul accord mineur : la basse descend de 3 notes (C → A) et la couleur devient triste.'),
    P('I-vi-ii-V', 'I – VI – II – V (3 sons)', 'major', [[0, 0, 'maj', 'I'], [5, 9, 'min', 'VIm'], [1, 2, 'min', 'IIm'], [4, 7, 'maj', 'V']], 'Le turnaround en accords de 3 sons : la basse descend par quintes à partir du VI.'),
    P('iiVItri', 'II – V – I (3 sons)', 'major', [[1, 2, 'min', 'IIm'], [4, 7, 'maj', 'V'], [0, 0, 'maj', 'I']], 'La cadence du jazz, sans les 7es : mineur, majeur, majeur, la basse monte de quarte.'),
    P('i-iv-V', 'I – IV – V – I mineur', 'minor', [[0, 0, 'min', 'Im'], [3, 5, 'min', 'IVm'], [4, 7, 'maj', 'V'], [0, 0, 'min', 'Im']], 'En mineur, le V est majeur grâce à la sensible : Am Dm E Am.'),
    P('iiVimtri', 'II – V – I mineur (3 sons)', 'minor', [[1, 2, 'dim', 'II°'], [4, 7, 'maj', 'V'], [0, 0, 'min', 'Im']], 'Le II du mineur est diminué, le V majeur, le I mineur.'),
    P('coltrane', 'Coltrane changes', 'major', [[0, 0, 'maj7', 'IΔ7'], [2, 3, '7', '♭III7'], [5, 8, 'maj7', '♭VIΔ7'], [6, 11, '7', 'VII7'], [2, 4, 'maj7', 'IIIΔ7']], 'Trois centres tonaux à une tierce majeure d’écart, reliés par leur V7.')
  ].map((p) => [p.id, p])
);

export const romanLine = (id: string) => PROGRESSIONS[id].steps.map((s) => s[3]).join(' – ');

/** Accords d'un enchaînement dans une tonalité donnée (orthographe tirée de la lettre de la tonique). */
export function spellProgression(key: Key, id: string): { chord: Chord; roman: string }[] {
  const t = pcOf(key.tonic);
  return PROGRESSIONS[id].steps.map(([off, semis, quality, roman]) => ({
    chord: { root: spellWith(key.tonic.letter + off, t + semis), quality },
    roman
  }));
}

/** Tonalité usuelle (peu d'altérations) sur une classe de hauteur, dans le mode de l'enchaînement. */
export const keyFor = (id: string, pc: number): Key => keyOnPc(pc, PROGRESSIONS[id].mode);
