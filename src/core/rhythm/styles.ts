// Styles d'accompagnement : batterie, basse et comping propres à chaque style, et comment les reconnaître.
import type { DrumSound } from '../audio/engine';

export type StyleId = 'swing' | 'ballade' | 'valse' | 'bossa' | 'samba' | 'latin' | 'funk';
/** [temps dans la mesure, son, vélocité] */
export type DrumHit = [number, DrumSound, number];
/** [temps depuis le début de l'accord, durée en temps] */
export type CompHit = [number, number];
export type BassRole = 'root' | 'fifth' | 'oct' | 'next';
/** [temps depuis le début de l'accord, rôle, durée en temps] */
export type BassHit = [number, BassRole, number];

export interface Groove {
  id: StyleId;
  name: string;
  meter: 3 | 4;
  /** Place de la croche du « et » dans le temps : 0,5 droit, 2/3 ternaire. */
  swing: number;
  tempo: [number, number];
  defaultTempo: number;
  /** Un motif de batterie par mesure ; le cycle se répète (1 ou 2 mesures). */
  drums: DrumHit[][];
  /** Basse : walking (noires choisies) ou motif fixe selon la durée de l'accord. */
  bass: 'walking' | ((beats: number) => BassHit[]);
  /** Comping : motifs possibles selon la durée de l'accord (4, 3 ou 2 temps et moins). */
  comp: { 4?: CompHit[][]; 3?: CompHit[][]; 2: CompHit[][] };
  /** Ce qu'on entend pour le reconnaître. */
  cues: string[];
  summary: string;
}

const SW = 2 / 3;
const eighths = (sound: DrumSound, on: number, off: number, meter = 4): DrumHit[] =>
  Array.from({ length: meter * 2 }, (_, i) => [i / 2, sound, i % 2 ? off : on] as DrumHit);

export const GROOVES: Record<StyleId, Groove> = {
  swing: {
    id: 'swing',
    name: 'Swing',
    meter: 4,
    swing: SW,
    tempo: [90, 280],
    defaultTempo: 140,
    drums: [
      [
        [0, 'ride', 0.17], [1, 'ride', 0.22], [1 + SW, 'ride', 0.1], [2, 'ride', 0.17], [3, 'ride', 0.22], [3 + SW, 'ride', 0.1],
        [1, 'pedal', 0.28], [3, 'pedal', 0.28]
      ]
    ],
    bass: 'walking',
    comp: {
      4: [
        [[0, 0.9], [1 + SW, 1.3]], // Charleston
        [[1, 0.7], [3, 0.7]],
        [[0, 1.8], [2 + SW, 0.9]],
        [[1 + SW, 1.8]],
        [[0, 0.5], [2, 0.9], [3 + SW, 0.4]]
      ],
      2: [[[0, 0.9]], [[SW, 1.1]], [[0, 0.5], [1 + SW, 0.4]]]
    },
    cues: [
      'Cymbale ride « ding, ding-ga ding » : croches ternaires (longue, courte)',
      'Charleston (pédale) fermé sur 2 et 4',
      'Contrebasse en noires : la walking bass',
      'Piano qui ponctue, souvent sur les contretemps'
    ],
    summary: 'Le style de base du jazz : croches ternaires, accent sur 2 et 4, walking bass.'
  },
  ballade: {
    id: 'ballade',
    name: 'Ballade',
    meter: 4,
    swing: SW,
    tempo: [48, 90],
    defaultTempo: 66,
    drums: [
      [
        [0, 'brush', 0.1], [1, 'brush', 0.14], [2, 'brush', 0.1], [3, 'brush', 0.14],
        [1, 'pedal', 0.12], [3, 'pedal', 0.12], [0, 'ride', 0.07], [2, 'ride', 0.07]
      ]
    ],
    bass: (b) => (b >= 4 ? [[0, 'root', 1.9], [2, 'fifth', 1.9]] : [[0, 'root', b - 0.1]]),
    comp: {
      4: [[[0, 3.8]], [[0, 1.9], [2, 1.9]], [[0, 2.6], [3, 0.9]]],
      2: [[[0, 1.9]]]
    },
    cues: ['Tempo lent (50 à 80)', 'Balais sur la caisse claire, presque pas de cymbale', 'Basse sur 1 et 3 (« en deux »)', 'Accords tenus, beaucoup d’espace'],
    summary: 'Lent, aux balais : on laisse sonner les accords.'
  },
  valse: {
    id: 'valse',
    name: 'Valse jazz',
    meter: 3,
    swing: SW,
    tempo: [100, 220],
    defaultTempo: 150,
    drums: [[[0, 'ride', 0.2], [1, 'ride', 0.17], [1 + SW, 'ride', 0.1], [2, 'ride', 0.17], [1, 'pedal', 0.22], [2, 'pedal', 0.22], [0, 'kick', 0.22]]],
    bass: (b) => (b >= 3 ? [[0, 'root', 1.8], [2, 'fifth', 0.9]] : [[0, 'root', b - 0.1]]),
    comp: {
      3: [[[1, 0.8], [2, 0.8]], [[0, 1.4], [1 + SW, 1.1]], [[0, 0.9], [2, 0.8]]],
      2: [[[0, 0.9]]]
    },
    cues: ['3 temps par mesure : « UN deux trois »', 'Ride ternaire, charleston sur 2 et 3', 'Basse surtout sur le 1', 'Plus léger et tournoyant que le swing à 4 temps'],
    summary: 'Le swing à 3 temps (Someday My Prince Will Come, Waltz for Debby).'
  },
  bossa: {
    id: 'bossa',
    name: 'Bossa nova',
    meter: 4,
    swing: 0.5,
    tempo: [100, 170],
    defaultTempo: 130,
    drums: [
      [...eighths('shaker', 0.12, 0.07), [0, 'rim', 0.22], [1.5, 'rim', 0.22], [3, 'rim', 0.22], [0, 'kick', 0.3], [1.5, 'kick', 0.16], [2, 'kick', 0.28], [3.5, 'kick', 0.16]],
      [...eighths('shaker', 0.12, 0.07), [1, 'rim', 0.22], [2.5, 'rim', 0.22], [0, 'kick', 0.3], [1.5, 'kick', 0.16], [2, 'kick', 0.28], [3.5, 'kick', 0.16]]
    ],
    bass: (b) => (b >= 4 ? [[0, 'root', 1.4], [1.5, 'fifth', 0.45], [2, 'fifth', 1.4], [3.5, 'root', 0.45]] : [[0, 'root', 1.4], [1.5, 'fifth', 0.45]]),
    comp: {
      4: [[[0, 1], [1.5, 0.8], [3, 0.8]], [[0, 1.4], [2.5, 1.2]], [[0.5, 1], [2, 1], [3.5, 0.5]]],
      2: [[[0, 1], [1.5, 0.4]]]
    },
    cues: [
      'Croches droites (binaire), tempo modéré, ambiance douce',
      'Coups de bord de caisse claire (rim) sur un motif de 2 mesures : la clave de bossa',
      'Basse « boum… ba-boum » : fondamentale sur 1, quinte sur 3, chacune annoncée une croche avant',
      'Piano ou guitare en accords syncopés'
    ],
    summary: 'Brésil, années 1960 (Jobim, Getz) : une samba ralentie et feutrée.'
  },
  samba: {
    id: 'samba',
    name: 'Samba',
    meter: 4,
    swing: 0.5,
    tempo: [160, 260],
    defaultTempo: 200,
    drums: [
      [
        ...Array.from({ length: 16 }, (_, i) => [i / 4, 'shaker', i % 2 ? 0.06 : 0.12] as DrumHit),
        [0, 'surdo', 0.2], [1, 'surdo', 0.55], [2, 'surdo', 0.2], [3, 'surdo', 0.55],
        [0, 'rim', 0.2], [0.75, 'rim', 0.18], [1.5, 'rim', 0.2], [2.5, 'rim', 0.2], [3.25, 'rim', 0.18]
      ],
      [
        ...Array.from({ length: 16 }, (_, i) => [i / 4, 'shaker', i % 2 ? 0.06 : 0.12] as DrumHit),
        [0, 'surdo', 0.2], [1, 'surdo', 0.55], [2, 'surdo', 0.2], [3, 'surdo', 0.55],
        [0.5, 'rim', 0.2], [1.5, 'rim', 0.2], [2.25, 'rim', 0.18], [3, 'rim', 0.2]
      ]
    ],
    bass: (b) => (b >= 4 ? [[0, 'root', 0.9], [1.5, 'fifth', 0.4], [2, 'fifth', 0.9], [3.5, 'root', 0.4]] : [[0, 'root', 0.9], [1.5, 'fifth', 0.4]]),
    comp: {
      4: [[[0.5, 0.4], [1.5, 0.4], [2.5, 0.4], [3, 0.6]], [[0, 0.4], [0.75, 0.4], [1.5, 0.4], [2.5, 0.4], [3.25, 0.4]]],
      2: [[[0.5, 0.4], [1.5, 0.4]]]
    },
    cues: [
      'Rapide et dansant, on le sent « à 2 temps »',
      'Surdo (grosse percussion grave) appuyé sur 2 et 4',
      'Shaker (ganzá) en doubles croches continues',
      'Tamborim et piano très syncopés'
    ],
    summary: 'Brésil, le carnaval : rapide, percussif, le surdo appuyé sur 2 et 4.'
  },
  latin: {
    id: 'latin',
    name: 'Afro-cubain',
    meter: 4,
    swing: 0.5,
    tempo: [150, 240],
    defaultTempo: 180,
    drums: [
      [[1, 'clave', 0.3], [2, 'clave', 0.3], [0, 'cowbell', 0.22], [1, 'cowbell', 0.15], [2, 'cowbell', 0.18], [3, 'cowbell', 0.15], [1, 'rim', 0.14], [3, 'conga', 0.22], [3.5, 'conga', 0.2], [1.5, 'kick', 0.22], [3, 'kick', 0.22]],
      [[0, 'clave', 0.3], [1.5, 'clave', 0.3], [3, 'clave', 0.3], [0, 'cowbell', 0.22], [1, 'cowbell', 0.15], [2, 'cowbell', 0.18], [3, 'cowbell', 0.15], [1, 'rim', 0.14], [3, 'conga', 0.22], [3.5, 'conga', 0.2], [1.5, 'kick', 0.22], [3, 'kick', 0.22]]
    ],
    bass: (b) => (b >= 4 ? [[1.5, 'fifth', 1.4], [3, 'next', 1.9]] : [[0, 'root', 0.9], [1, 'fifth', 0.9]]),
    comp: {
      4: [[[0.5, 0.3], [1, 0.3], [2, 0.3], [2.5, 0.3], [3.5, 0.3]], [[0, 0.3], [0.5, 0.3], [1.5, 0.3], [2.5, 0.3], [3, 0.3]]],
      2: [[[0.5, 0.3], [1.5, 0.3]]]
    },
    cues: [
      'La clave (deux bâtons de bois) : un motif de 2 mesures, 2 coups puis 3 coups',
      'Cloche (campana) sur les temps',
      'Basse « tumbao » : rien sur le 1, des notes sur le « et » de 2 et sur le 4, qui anticipent l’accord suivant',
      'Piano en « montuno » : un motif syncopé répété'
    ],
    summary: 'Cuba (son, salsa, latin jazz) : tout s’organise autour de la clave.'
  },
  funk: {
    id: 'funk',
    name: 'Funk',
    meter: 4,
    swing: 0.5,
    tempo: [80, 125],
    defaultTempo: 100,
    drums: [
      [
        ...Array.from({ length: 16 }, (_, i) => [i / 4, 'hat', i % 2 ? 0.06 : 0.13] as DrumHit),
        [1, 'snare', 0.42], [3, 'snare', 0.42], [1.75, 'snare', 0.06], [3.25, 'snare', 0.06],
        [0, 'kick', 0.45], [1.75, 'kick', 0.3], [2.5, 'kick', 0.35]
      ]
    ],
    bass: (b) =>
      b >= 4
        ? [[0, 'root', 0.35], [0.75, 'root', 0.2], [1.5, 'oct', 0.3], [2.5, 'root', 0.35], [3, 'fifth', 0.2], [3.5, 'oct', 0.2]]
        : [[0, 'root', 0.35], [0.75, 'root', 0.2], [1.5, 'oct', 0.3]],
    comp: {
      4: [[[0.5, 0.2], [1.75, 0.2], [2.5, 0.2], [3.75, 0.2]], [[0.25, 0.2], [1, 0.2], [2.75, 0.2], [3.5, 0.2]]],
      2: [[[0.5, 0.2], [1.75, 0.2]]]
    },
    cues: [
      'Doubles croches droites (binaire), tempo moyen',
      'Caisse claire forte sur 2 et 4 (le « backbeat »)',
      'Grosse caisse syncopée, et la basse qui joue avec elle',
      'Accords courts et percussifs'
    ],
    summary: 'Binaire et groovy (Herbie Hancock, Head Hunters) : tout en doubles croches.'
  }
};

export const STYLE_ORDER: StyleId[] = ['swing', 'ballade', 'valse', 'bossa', 'samba', 'latin', 'funk'];

/** Style de la grille → groove (le « blues » se joue en swing). */
export const grooveOf = (style: string): Groove => GROOVES[(style === 'blues' ? 'swing' : style) as StyleId] ?? GROOVES.swing;
