// Le parcours : 10 étapes, du débutant à l'improvisation. Chaque étape : des leçons, des exercices dans le
// métro (sans piano) et au piano (le micro valide), parfois un morceau. Les exercices réutilisent les briques
// de l'appli avec un réglage fixé ici et un objectif clair.
import type { VoicingType } from '../core/audio/voicing';
import type { Order } from '../modules/flash/batch';
import type { CompVoicing } from '../modules/flash/comping';
import type { RythmeExercise } from '../modules/rythme/Rythme';

export type Where = 'metro' | 'piano';

/** Ce qui se lance : la brique et son réglage. */
export type Run =
  | { kind: 'lecture'; level: number; answer: 'clavier' | 'piano' }
  | { kind: 'tonalite'; level: number }
  | { kind: 'express'; level: number }
  | { kind: 'reharm'; level: number }
  | { kind: 'ear'; mode: 'ear' | 'build' | 'prog'; level: number }
  | { kind: 'full'; level: number }
  | { kind: 'iv'; level: number }
  | { kind: 'bass'; level: number }
  | { kind: 'flash'; type: VoicingType; order: Order; level?: number }
  | { kind: 'comping'; level: number; voicing: CompVoicing }
  | { kind: 'phrase'; line: string }
  | { kind: 'chart'; chart: string; mode: 'analyser' | 'memoire' | 'guide' | 'gammes' | 'analyse'; memLevel?: number }
  /** Rythme : niveau = variante (tenir le tempo) ou niveau de rythme ; au piano, le micro écoute les coups. */
  | { kind: 'rythme'; exercise: RythmeExercise; level: number };

/** Quand l'exercice est validé. */
export type Goal =
  /** n réponses, au moins min justes (takes : des passages en rythme, réussis ou non). */
  | { kind: 'answers'; n: number; min: number; takes?: boolean }
  /** Analyser une grille : part des enchaînements trouvés. */
  | { kind: 'analyse'; ratio: number }
  /** Jouer la grille au micro : part des accords réussis, sur au moins `chords` accords. */
  | { kind: 'listen'; ratio: number; chords: number }
  /** Mémoire : un passage complet au niveau donné, part de bonnes réponses. */
  | { kind: 'memoire'; ratio: number };

export interface Activity {
  id: string;
  title: string;
  /** Ce qu'on fait, en une ligne. */
  sub: string;
  where: Where;
  run: Run;
  goal: Goal;
  /** « Pour aller plus loin » : ne compte pas pour finir l'étape. */
  optional?: boolean;
}

export interface Step {
  id: string;
  title: string;
  /** Ce qu'on saura faire à la fin. */
  aim: string;
  lessons: string[];
  activities: Activity[];
}

const Q10 = { kind: 'answers', n: 10, min: 8 } as const;
/** Rythme : 3 passages de 8 mesures, 2 réussis ; ou 5 rythmes tapés, 3 réussis. */
const T3: Goal = { kind: 'answers', n: 3, min: 2, takes: true };
const T5: Goal = { kind: 'answers', n: 5, min: 3, takes: true };
const A = (id: string, title: string, sub: string, where: Where, run: Run, goal: Goal = Q10, optional = false): Activity => ({ id, title, sub, where, run, goal, optional });

export const STEPS: Step[] = [
  {
    id: 'notes',
    title: 'Notes et intervalles',
    aim: 'Trouver les notes, compter tons et demi-tons, reconnaître les intervalles qui font les accords. Et taper un tempo régulier.',
    lessons: ['clavier', 'intervalles'],
    activities: [
      A('n-lire', 'Lire les notes', 'Une note sur la portée, tu la trouves au clavier', 'metro', { kind: 'lecture', level: 1, answer: 'clavier' }),
      A('n-iv', 'Intervalles à l’oreille', '3ce mineure ou majeure, 4te, 5te, octave', 'metro', { kind: 'iv', level: 0 }),
      A('n-piano', 'Jouer les notes lues', 'Au piano : le micro vérifie la note', 'piano', { kind: 'lecture', level: 1, answer: 'piano' }),
      A('r-tempo', 'Tenir le tempo', 'Taper les 4 temps avec le métronome', 'metro', { kind: 'rythme', exercise: 'tempo', level: 0 }, T3),
      A('n-fa', 'La clé de fa', 'Les notes de la main gauche', 'metro', { kind: 'lecture', level: 2, answer: 'clavier' }, Q10, true)
    ]
  },
  {
    id: 'triades',
    title: 'Les accords de 3 sons',
    aim: 'Construire et reconnaître les accords majeurs et mineurs, sur n’importe quelle note.',
    lessons: ['triades'],
    activities: [
      A('t-build', 'Construire l’accord', 'Un symbole (Em, B♭…), tu touches ses 3 notes', 'metro', { kind: 'ear', mode: 'build', level: 0 }),
      A('t-ear', 'Majeur ou mineur ?', 'À l’oreille', 'metro', { kind: 'ear', mode: 'ear', level: 0 }),
      A('r-noires', 'Lire et taper un rythme', 'Des noires : l’écouter, le taper', 'metro', { kind: 'rythme', exercise: 'taper', level: 0 }, T5),
      A('t-piano', 'Jouer les accords', 'Au piano, dans le renversement que tu veux', 'piano', { kind: 'flash', type: 'triad', order: 'random' })
    ]
  },
  {
    id: 'gamme',
    title: 'La gamme et ses accords',
    aim: 'Savoir quel accord se trouve sur chaque degré, et entendre I, IV et V.',
    lessons: ['tonalite-3', 'premiers'],
    activities: [
      A('g-ton', 'Quel accord sur ce degré ?', 'Une tonalité, une note : majeur, mineur ou diminué', 'metro', { kind: 'tonalite', level: 0 }),
      A('g-bass', 'La basse : I, IV ou V ?', 'Quatre notes de contrebasse après l’accord de la tonique', 'metro', { kind: 'bass', level: 0 }, { kind: 'answers', n: 20, min: 16 }),
      A('g-full', 'Quel accord, dans la tonalité ?', 'L’accord de la tonique, puis un accord de la gamme', 'metro', { kind: 'full', level: 0 }),
      A('r-24', 'Sur 2 et 4', 'Le clic compte les 4 temps, tu tapes 2 et 4', 'metro', { kind: 'rythme', exercise: 'tempo', level: 1 }, T3),
      A('g-piano', 'Enchaîner ii–V–I', 'En 3 sons, le renversement le plus proche', 'piano', { kind: 'flash', type: 'triad', order: 'iiVI' }, { kind: 'answers', n: 9, min: 7 })
    ]
  },
  {
    id: 'quatre',
    title: 'Les accords de 4 sons',
    aim: 'Construire et reconnaître maj7, m7, 7, ø7 et °7 : les accords du jazz. Sentir les croches swing.',
    lessons: ['construire', 'caracteres', 'swing'],
    activities: [
      A('q-build', 'Construire maj7, m7, 7', 'Un symbole, tu touches ses 4 notes', 'metro', { kind: 'ear', mode: 'build', level: 1 }),
      A('q-ear', 'maj7, m7 ou 7 ?', 'À l’oreille', 'metro', { kind: 'ear', mode: 'ear', level: 1 }),
      A('q-ear2', '+ ø7 et °7', 'À l’oreille, 5 natures', 'metro', { kind: 'ear', mode: 'ear', level: 2 }),
      A('r-croches', 'Taper des croches swing', 'Longue-courte : « dou-ba »', 'metro', { kind: 'rythme', exercise: 'taper', level: 1 }, T5),
      A('q-piano', 'Shells : 1, 3, 7', 'Au piano, main gauche', 'piano', { kind: 'flash', type: 'shell', order: 'random', level: 2 })
    ]
  },
  {
    id: 'iivi',
    title: 'Le ii–V–I',
    aim: 'Reconnaître le ii–V–I partout : à la lecture, à l’oreille, dans la basse.',
    lessons: ['tonalite', 'iiVI'],
    activities: [
      A('i-ton', 'Les accords de la tonalité', 'En 4 sons : IΔ7, IIm7, V7…', 'metro', { kind: 'tonalite', level: 1 }),
      A('i-exp', 'Analyser des enchaînements', 'Degrés, ii–V, tonalité', 'metro', { kind: 'express', level: 1 }, { kind: 'answers', n: 12, min: 10 }),
      A('i-prog', 'Reconnaître les enchaînements', 'À l’oreille : ii–V–I, turnarounds', 'metro', { kind: 'ear', mode: 'prog', level: 1 }),
      A('i-bass', 'La basse des grilles', 'I, II, IV, V, VI', 'metro', { kind: 'bass', level: 1 }, { kind: 'answers', n: 20, min: 16 }),
      A('r-ear1', 'Reconnaître un rythme', 'Croches swing : l’entendre, le retrouver écrit', 'metro', { kind: 'rythme', exercise: 'oreille', level: 1 }),
      A('r-clic24', 'Clic sur 2 et 4', 'Le clic sur 2 et 4 seulement : tu tapes les 4 temps', 'metro', { kind: 'rythme', exercise: 'tempo', level: 2 }, T3),
      A('i-piano', 'ii–V–I en shells', 'Au piano, dans toutes les tonalités', 'piano', { kind: 'flash', type: 'shell', order: 'iiVI' }, { kind: 'answers', n: 9, min: 7 })
    ]
  },
  {
    id: 'voicings',
    title: 'Voicings et guide tones',
    aim: 'Jouer les ii–V–I sans fondamentale (A et B) dans les 12 tonalités, entendre l’accord entier.',
    lessons: ['voicings'],
    activities: [
      A('v-full', 'Accord entier', 'Fondamentale et nature, dans la tonalité', 'metro', { kind: 'full', level: 1 }),
      A('v-iv', 'Les 12 intervalles', 'À l’oreille, en montant', 'metro', { kind: 'iv', level: 2 }),
      A('r-contre', 'Taper les contretemps', 'Charleston, contretemps de 2 et 4', 'metro', { kind: 'rythme', exercise: 'taper', level: 2 }, T5),
      A('v-ab', 'Voicings A et B', 'ii–V–I : A, B, A', 'piano', { kind: 'flash', type: 'A', order: 'iiVI' }, { kind: 'answers', n: 9, min: 8 }),
      A('v-12', 'ii–V–I dans les 12 tonalités', 'Par quartes : C, F, B♭…', 'piano', { kind: 'flash', type: 'A', order: 'iiVI12' }, { kind: 'answers', n: 36, min: 30 }),
      A('v-guide', 'Guide tones sur Autumn Leaves', 'Au micro : la 3ce ou la 7e sur le 1er temps', 'piano', { kind: 'chart', chart: 'autumn-leaves', mode: 'guide' }, { kind: 'listen', ratio: 0.8, chords: 12 })
    ]
  },
  {
    id: 'grilles',
    title: 'Lire une grille : le blues',
    aim: 'Analyser, retenir et accompagner un blues jazz en rythme.',
    lessons: ['blues', 'turnarounds', 'comping'],
    activities: [
      A('b-analyse', 'Analyser le Blues en F', 'Repérer les ii–V et les dominantes', 'metro', { kind: 'chart', chart: 'blues-f', mode: 'analyser' }, { kind: 'analyse', ratio: 0.8 }),
      A('b-mem', 'Le Blues en F de mémoire', 'La moitié des accords cachés', 'metro', { kind: 'chart', chart: 'blues-f', mode: 'memoire', memLevel: 1 }, { kind: 'memoire', ratio: 0.8 }),
      A('r-comping', 'Taper les rythmes de comping', 'Motifs de 2 mesures, anticipations', 'metro', { kind: 'rythme', exercise: 'taper', level: 3 }, T5),
      A('b-comp1', 'Comping : 1 et 3', 'Sur la grille, avec basse et batterie', 'piano', { kind: 'comping', level: 0, voicing: 'shell' }, { kind: 'answers', n: 15, min: 12 }),
      A('b-comp2', 'Comping : Charleston', 'Le 1, puis le « et » de 2', 'piano', { kind: 'comping', level: 1, voicing: 'AB' }, { kind: 'answers', n: 15, min: 12 }),
      A('b-joue', 'Accompagner le Blues en F', 'Au micro, avec le play-along', 'piano', { kind: 'chart', chart: 'blues-f', mode: 'analyse' }, { kind: 'listen', ratio: 0.9, chords: 12 }),
      A('r-ear3', 'Reconnaître un rythme de comping', 'Charleston, anticipations : à l’oreille', 'metro', { kind: 'rythme', exercise: 'oreille', level: 3 }, Q10, true),
      A('r-1sur2', 'Une mesure sur deux', 'Le clic se tait une mesure sur deux', 'metro', { kind: 'rythme', exercise: 'tempo', level: 3 }, T3, true),
      A('b-comp3', 'Comping : anticipations', 'L’accord suivant sur le « et » de 4', 'piano', { kind: 'comping', level: 3, voicing: 'AB' }, { kind: 'answers', n: 15, min: 12 }, true)
    ]
  },
  {
    id: 'mineur',
    title: 'Le mineur et les dominantes secondaires',
    aim: 'Le ii–V–i mineur, les dominantes qui mènent à chaque accord. Reconnaître les styles : swing, bossa, latin…',
    lessons: ['iiVim', 'secondaires', 'backdoor', 'styles'],
    activities: [
      A('m-exp', 'Analyser : mineur et dominantes', 'Degrés, ii–V, 9 ou ♭9', 'metro', { kind: 'express', level: 2 }, { kind: 'answers', n: 12, min: 10 }),
      A('m-full', 'Dominantes secondaires à l’oreille', 'Accord entier : VI7, II7, III7…', 'metro', { kind: 'full', level: 2 }),
      A('m-reharm', 'Ajouter des dominantes', 'La dominante qui mène à un accord, et son ii', 'metro', { kind: 'reharm', level: 1 }),
      A('m-autumn', 'Analyser Autumn Leaves', 'ii–V majeurs et mineurs', 'metro', { kind: 'chart', chart: 'autumn-leaves', mode: 'analyser' }, { kind: 'analyse', ratio: 0.8 }),
      A('r-style', 'Reconnaître un style', 'Swing, ballade, valse, bossa, samba, latin, funk', 'metro', { kind: 'rythme', exercise: 'style', level: 0 }),
      A('m-piano', 'ii–V–i mineurs', 'Au piano, A et B', 'piano', { kind: 'flash', type: 'A', order: 'iiVim' }, { kind: 'answers', n: 9, min: 7 })
    ]
  },
  {
    id: 'subst',
    title: 'Substitutions et couleurs',
    aim: 'SubV, diminués de passage, tensions, et les voicings à deux mains qui vont avec.',
    lessons: ['subv', 'reharm', 'tensions', 'deux-mains'],
    activities: [
      A('s-subv', 'Le SubV', 'D♭7 à la place de G7', 'metro', { kind: 'reharm', level: 0 }),
      A('s-dim', 'Diminués et ii–V', 'Diminués de passage, ii–V du SubV', 'metro', { kind: 'reharm', level: 3 }),
      A('s-ear', 'Couleurs : 9, ♭9, ♯9, 13', 'À l’oreille', 'metro', { kind: 'ear', mode: 'ear', level: 4 }),
      A('s-spot', 'Quelle réharmonisation ?', 'Avant / après, à l’oreille', 'metro', { kind: 'reharm', level: 4 }),
      A('r-seul', 'Tenir le tempo seul', '2 mesures de clic, puis 6 mesures sans', 'metro', { kind: 'rythme', exercise: 'tempo', level: 4 }, T3),
      A('s-2m', 'Deux mains : écartés', 'MG 1-7, MD 3-5-9', 'piano', { kind: 'flash', type: 'spread', order: 'iiVI' }, { kind: 'answers', n: 9, min: 7 }),
      A('s-us', 'Upper structures', 'MG 3-7, MD une triade', 'piano', { kind: 'flash', type: 'us', order: 'iiVI' }, { kind: 'answers', n: 9, min: 7 }),
      A('s-4tes', 'Quartes : So What', 'Voicings en quartes', 'piano', { kind: 'flash', type: 'quartal', order: 'iiVI' }, { kind: 'answers', n: 9, min: 7 }, true),
      A('r-triolets', 'Taper des triolets', 'Trois notes par temps', 'metro', { kind: 'rythme', exercise: 'taper', level: 4 }, T5, true),
      A('s-drop2', 'Drop 2', 'L’accord serré, la 2e voix à la main gauche', 'piano', { kind: 'flash', type: 'drop2', order: 'iiVI' }, { kind: 'answers', n: 9, min: 7 }, true)
    ]
  },
  {
    id: 'impro',
    title: 'Improviser sur les accords',
    aim: 'Une gamme par accord, du vocabulaire sur ii–V–I, et le standard joué de mémoire.',
    lessons: ['gammes', 'clave'],
    activities: [
      A('im-exp', 'Une gamme par accord', 'Analyse et gammes', 'metro', { kind: 'express', level: 3 }, { kind: 'answers', n: 12, min: 10 }),
      A('im-mem', 'Autumn Leaves de mémoire', 'Toute la grille cachée', 'metro', { kind: 'chart', chart: 'autumn-leaves', mode: 'memoire', memLevel: 3 }, { kind: 'memoire', ratio: 0.8 }),
      A('r-claves', 'Taper les claves', 'Son, rumba, bossa', 'metro', { kind: 'rythme', exercise: 'taper', level: 5 }, T5),
      A('im-ph1', 'Phrase : arpèges', '1-3-5-7, rejouée dans 4 tonalités', 'piano', { kind: 'phrase', line: 'arp1357' }, { kind: 'answers', n: 4, min: 3 }),
      A('im-ph2', 'Phrase : gamme bebop', 'Les notes de l’accord sur les temps', 'piano', { kind: 'phrase', line: 'bebop' }, { kind: 'answers', n: 4, min: 3 }),
      A('im-ph3', 'Phrase : encerclements', 'La note visée, entourée', 'piano', { kind: 'phrase', line: 'enclos' }, { kind: 'answers', n: 4, min: 3 }),
      A('im-gammes', 'Improviser sur Autumn Leaves', 'Au micro : notes de l’accord sur le 1er temps', 'piano', { kind: 'chart', chart: 'autumn-leaves', mode: 'gammes' }, { kind: 'listen', ratio: 0.7, chords: 12 }),
      A('im-ph4', 'Phrase : approches chromatiques', 'Un demi-ton sous la note suivante', 'piano', { kind: 'phrase', line: 'chroma' }, { kind: 'answers', n: 4, min: 3 }, true),
      A('im-ph5', 'Phrase : ii–V–i mineur', 'Dø7, G7♭9, Cm6', 'piano', { kind: 'phrase', line: 'mineur' }, { kind: 'answers', n: 4, min: 3 }, true),
      A('im-ph6', 'Phrase : dominante altérée', 'La triade de E♭ sur G7alt', 'piano', { kind: 'phrase', line: 'alt' }, { kind: 'answers', n: 4, min: 3 }, true)
    ]
  }
];

export const stepById = (id: string) => STEPS.find((s) => s.id === id);
export const activityById = (id: string): { step: Step; act: Activity } | undefined => {
  for (const step of STEPS) {
    const act = step.activities.find((a) => a.id === id);
    if (act) return { step, act };
  }
  return undefined;
};
export const goalText = (g: Goal) =>
  g.kind === 'answers'
    ? `${g.min} ${g.takes ? 'réussis' : 'justes'} sur ${g.n}`
    : g.kind === 'analyse'
      ? `${Math.round(g.ratio * 100)} % des enchaînements trouvés`
      : g.kind === 'listen'
        ? `${Math.round(g.ratio * 100)} % au micro, sur ${g.chords} accords au moins`
        : `${Math.round(g.ratio * 100)} % de bonnes réponses`;

/** Niveaux de départ proposés au premier lancement (index de l'étape). */
export const PLACEMENTS = [
  { step: 0, label: 'Je débute', sub: 'Les notes, les intervalles, les premiers accords' },
  { step: 3, label: 'Je connais les accords de 3 sons', sub: 'On commence par les accords de 4 sons' },
  { step: 5, label: 'Je joue déjà des ii–V–I', sub: 'On commence par les voicings sans fondamentale' }
];
