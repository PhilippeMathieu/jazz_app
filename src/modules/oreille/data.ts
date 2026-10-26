// Contenu pédagogique du module Oreille.

export const HINTS: Record<string, string> = {
  maj: 'Tierce majeure (2 tons) puis tierce mineure : son clair, stable.',
  min: 'Tierce mineure (1 ton ½) puis tierce majeure : son plus sombre, plus doux.',
  maj7: 'Tierce majeure + 7e majeure. Stable, lumineux : l’accord de tonique.',
  m7: 'Tierce mineure + 7e mineure. Doux ; c’est le II du ii–V–I.',
  '7': 'Tierce majeure + 7e mineure. Le triton entre 3 et 7 crée la tension qui veut résoudre.',
  m7b5: 'm7♭5 : un m7 avec quinte diminuée. Le II du mode mineur.',
  dim7: 'Tierces mineures empilées : symétrique, se répète tous les 3 demi-tons. Très tendu, accord de passage.',
  '6': 'Majeur + 6te. Tonique « swing », plus douce que le maj7.',
  m6: 'Mineur + 6te majeure. Tonique mineure, couleur dorienne.',
  '7sus4': 'La 4te remplace la tierce : ni majeur ni mineur. Son flottant, modal.',
  mM7: 'Mineur + 7e majeure. Sombre, tendu ; tonique mineure.',
  maj9: 'maj7 + 9e. Plus ouvert.',
  m9: 'm7 + 9e. Velouté : le II « moderne ».',
  '9': '7 + 9e naturelle. Dominante douce, va plutôt vers le majeur.',
  '7b9': '7 + ♭9, un demi-ton au-dessus de la fondamentale. Dominante qui va vers le mineur.',
  '7#9': '7 + ♯9 : tierce majeure et « tierce mineure » ensemble. Blues, funk.',
  '13': '3, 7, 9 et 13, sans quinte. Dominante brillante.'
};

/** Qualités par niveau : 0 = débutant (3 sons), puis 1 à 4. */
export const QUALITY_LEVELS = [
  ['maj', 'min'],
  ['maj7', 'm7', '7'],
  ['maj7', 'm7', '7', 'm7b5', 'dim7'],
  ['maj7', 'm7', '7', 'm7b5', 'dim7', '6', 'm6', '7sus4', 'mM7'],
  ['maj7', 'maj9', 'm7', 'm9', '7', '9', '7b9', '7#9', '13']
];

/** Enchaînements par niveau (identifiants de core/theory/progressions). */
export const PROG_LEVELS = [
  ['I-IV-V', 'I-vi-IV-V', 'I-V-vi-IV', 'vi-IV-I-V'],
  ['iiVI', 'turn1', 'turn3', 'IVii'],
  ['iiVI', 'turn1', 'iiVim', 'sec', 'I7IV'],
  ['iiVI', 'subV', 'back', 'bridge', 'dimp'],
  ['subV', 'back', 'subVm', 'coltrane', 'casc']
];

export const LEVEL_LABELS = {
  ear: ['Débutant : majeur ou mineur (3 sons)', 'maj7 · m7 · 7', '+ ø7 · °7', '+ 6 · m6 · sus4 · m(maj7), renversés', '9 · ♭9 · ♯9 · 13, sans fondamentale'],
  prog: ['Débutant : I, IV, V, VIm en 3 sons', 'Diatonique', 'Mineur, secondaires', 'Substitutions', 'Avancé'],
  build: ['Débutant : majeur ou mineur (3 sons)', 'maj7 · m7 · 7', '+ ø7 · °7', '+ 6 · m6 · sus4 · m(maj7)', '9 · ♭9 · ♯9 · 13']
};

const INTERVAL: Record<number, string> = {
  3: 'tierce mineure',
  4: 'tierce majeure',
  5: 'quarte',
  6: 'quinte diminuée',
  7: 'quinte juste',
  8: 'quinte augmentée',
  9: 'sixte',
  10: '7e mineure',
  11: '7e majeure',
  13: '♭9',
  14: '9',
  15: '♯9',
  21: '13'
};
const intervalName = (q: string, i: number) => (q === 'dim7' && i === 9 ? '7e diminuée' : INTERVAL[i] ?? `${i} demi-tons`);

/** Ce qui distingue deux qualités d'accord, note par note (sur la même fondamentale). */
export function qualityDiff(a: string, b: string, iv: (q: string) => number[], name: (q: string) => string): string {
  const A = iv(a);
  const B = iv(b);
  const onlyA = A.filter((x) => !B.includes(x)).map((x) => intervalName(a, x));
  const onlyB = B.filter((x) => !A.includes(x)).map((x) => intervalName(b, x));
  if (!onlyA.length && !onlyB.length) return '';
  const part = (q: string, l: string[]) => (l.length ? `${name(q)} a ${l.join(' et ')}` : `${name(q)} n’a rien de plus`);
  return `Ce qui change : ${part(a, onlyA)} ; ${part(b, onlyB)}.`;
}
