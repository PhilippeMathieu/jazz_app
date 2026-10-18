// Contenu pédagogique du module Oreille.

export const HINTS: Record<string, string> = {
  maj7: 'Tierce majeure + 7e majeure. Stable, lumineux : l’accord de tonique.',
  m7: 'Tierce mineure + 7e mineure. Doux ; c’est le ii du ii–V–I.',
  '7': 'Tierce majeure + 7e mineure. Le triton entre 3 et 7 crée la tension qui veut résoudre.',
  m7b5: 'm7♭5 : un m7 avec quinte diminuée. Le ii du mode mineur.',
  dim7: 'Tierces mineures empilées : symétrique, se répète tous les 3 demi-tons. Très tendu, accord de passage.',
  '6': 'Majeur + 6te. Tonique « swing », plus douce que le maj7.',
  m6: 'Mineur + 6te majeure. Tonique mineure, couleur dorienne.',
  '7sus4': 'La 4te remplace la tierce : ni majeur ni mineur. Son flottant, modal.',
  mM7: 'Mineur + 7e majeure. Sombre, tendu ; tonique mineure.',
  maj9: 'maj7 + 9e. Plus ouvert. Main droite sans fondamentale (3-5-7-9).',
  m9: 'm7 + 9e. Velouté : le ii « moderne ».',
  '9': '7 + 9e naturelle. Dominante douce, résout plutôt vers le majeur.',
  '7b9': '7 + ♭9, un demi-ton au-dessus de la fondamentale. Dominante qui va vers le mineur.',
  '7#9': '7 + ♯9 : tierce majeure et « tierce mineure » ensemble. Blues, funk.',
  '13': 'Voicing 3-7-9-13, sans quinte. Dominante brillante.'
};

export const QUALITY_LEVELS = [
  ['maj7', 'm7', '7'],
  ['maj7', 'm7', '7', 'm7b5', 'dim7'],
  ['maj7', 'm7', '7', 'm7b5', 'dim7', '6', 'm6', '7sus4', 'mM7'],
  ['maj7', 'maj9', 'm7', 'm9', '7', '9', '7b9', '7#9', '13']
];

/** [décalage de lettre, demi-tons depuis la tonique, qualité, degré] */
export type ProgChord = [number, number, string, string];
export interface Prog {
  name: string;
  chords: ProgChord[];
  hint: string;
}

export const PROGS: Record<string, Prog> = {
  iiVI: { name: 'Cadence majeure', chords: [[1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7'], [0, 0, 'maj7', 'IΔ7']], hint: 'La cadence de base du jazz. La basse monte de quarte : II → V → I.' },
  ivi: { name: 'Turnaround I–VI', chords: [[0, 0, 'maj7', 'IΔ7'], [5, 9, 'm7', 'VIm7'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], hint: 'Turnaround classique : ramène vers le I en fin de grille.' },
  iiivi: { name: 'Turnaround III–VI', chords: [[2, 4, 'm7', 'IIIm7'], [5, 9, 'm7', 'VIm7'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], hint: 'Le III remplace le I (2 notes communes). Quartes à la basse.' },
  IVii: { name: 'Par le IV', chords: [[0, 0, 'maj7', 'IΔ7'], [3, 5, 'maj7', 'IVΔ7'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], hint: 'Passage par la sous-dominante, puis cadence ii–V.' },
  min: { name: 'Cadence mineure', chords: [[1, 2, 'm7b5', 'IIø7'], [4, 7, '7b9', 'V7♭9'], [0, 0, 'm6', 'Im6']], hint: 'ii–V–i mineur : ø7, puis 7♭9, puis tonique mineure.' },
  sec: { name: 'Dominante secondaire', chords: [[0, 0, 'maj7', 'IΔ7'], [5, 9, '7', 'V7/II'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], hint: 'VI7 = V7 du II. Le VIm7 devient dominante et tire vers le II.' },
  I7: { name: 'Vers le IV', chords: [[0, 0, 'maj7', 'IΔ7'], [0, 0, '7', 'V7/IV'], [3, 5, 'maj7', 'IVΔ7'], [3, 5, 'm6', 'IVm6']], hint: 'I7 tonicise le IV, puis IVm emprunté au mineur (couleur mélancolique).' },
  tri: { name: 'Substitution tritonique', chords: [[1, 2, 'm7', 'IIm7'], [1, 1, '7', 'SubV7'], [0, 0, 'maj7', 'IΔ7']], hint: 'SubV7 remplace V7 : même triton. Basse chromatique descendante.' },
  back: { name: 'Backdoor', chords: [[3, 5, 'm7', 'IVm7'], [6, 10, '7', '♭VII7'], [0, 0, 'maj7', 'IΔ7']], hint: 'Arrivée sur I par le ♭VII7 (emprunt au mineur). Résolution plus douce que V7.' },
  bridge: { name: 'Pont rhythm changes', chords: [[2, 4, '7', 'V7/VI'], [5, 9, '7', 'V7/II'], [1, 2, '7', 'V7/V'], [4, 7, '7', 'V7']], hint: 'Chaîne de dominantes en cycle de quartes : chaque 7 résout sur la suivante.' },
  dimp: { name: '°7 de passage', chords: [[0, 0, 'maj7', 'IΔ7'], [0, 1, 'dim7', '♯I°7'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7']], hint: 'Le °7 relie I et II par une basse chromatique montante. Il agit comme un V7♭9 du II.' },
  coltrane: { name: 'Coltrane changes', chords: [[0, 0, 'maj7', 'IΔ7'], [2, 3, '7', '♭III7'], [5, 8, 'maj7', '♭VIΔ7'], [6, 11, '7', 'VII7'], [2, 4, 'maj7', 'IIIΔ7']], hint: 'Trois centres tonaux à une tierce majeure d’écart, reliés chacun par son V7.' },
  casc: { name: 'ii–V en cascade', chords: [[2, 4, 'm7', 'IIIm7'], [5, 9, '7', 'V7/II'], [1, 2, 'm7', 'IIm7'], [4, 7, '7', 'V7'], [0, 0, 'maj7', 'IΔ7']], hint: 'Un ii–V vers le II, puis un ii–V vers le I.' },
  mintri: { name: 'Mineur + sub. tritonique', chords: [[1, 2, 'm7b5', 'IIø7'], [1, 1, '7', 'SubV7'], [0, 0, 'm6', 'Im6']], hint: 'Cadence mineure où SubV7 remplace le V7. Compare au ii–SubV–I majeur.' }
};

export const PROG_LEVELS = [
  ['iiVI', 'ivi', 'iiivi', 'IVii'],
  ['iiVI', 'ivi', 'min', 'sec', 'I7'],
  ['iiVI', 'tri', 'back', 'bridge', 'dimp'],
  ['tri', 'back', 'mintri', 'coltrane', 'casc']
];

export const progRoman = (id: string) => PROGS[id].chords.map((c) => c[3]).join(' – ');

export const LEVEL_LABELS = {
  ear: ['maj7 · m7 · 7', '+ ø7 · °7', '+ 6 · m6 · sus4 · m(maj7)', '9 · ♭9 · ♯9 · 13'],
  prog: ['Diatonique', 'Mineur, secondaires', 'Substitutions', 'Avancé'],
  build: ['maj7 · m7 · 7', '+ ø7 · °7', '+ 6 · m6 · sus4 · m(maj7)', '9 · ♭9 · ♯9 · 13']
};
