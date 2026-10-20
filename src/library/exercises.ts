import { Bar, Chart, keyName, keyOnPc, parseChart } from '../core/chart/model';
import { Chord } from '../core/theory/chords';
import { pcOf, spellWith } from '../core/theory/notes';

/** ii–V–I dans les 12 tonalités, en cycle de quartes (C, F, B♭…). */
function cycle(mode: 'major' | 'minor'): Chart {
  const order = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];
  const bars: Bar[] = [];
  for (const pc of order) {
    const key = keyOnPc(pc, mode);
    const t = key.tonic;
    const tp = pcOf(t);
    const ii: Chord = { root: spellWith(t.letter + 1, tp + 2), quality: mode === 'major' ? 'm7' : 'm7b5' };
    const v: Chord = { root: spellWith(t.letter + 4, tp + 7), quality: mode === 'major' ? '7' : '7b9' };
    const i: Chord = { root: t, quality: mode === 'major' ? 'maj7' : 'm6' };
    bars.push({ chords: [{ chord: ii, beats: 4 }], section: keyName(key) });
    bars.push({ chords: [{ chord: v, beats: 4 }] });
    bars.push({ chords: [{ chord: i, beats: 4 }] });
    bars.push({ chords: [{ chord: i, beats: 4 }] });
  }
  return {
    id: mode === 'major' ? 'cycle-maj' : 'cycle-min',
    title: mode === 'major' ? 'ii–V–I, 12 tonalités' : 'ii–V–i mineur, 12 tonalités',
    subtitle: 'Cycle de quartes',
    key: keyOnPc(0, mode),
    tempo: 100,
    style: 'swing',
    beatsPerBar: 4,
    level: mode === 'major' ? 1 : 2,
    notes:
      mode === 'major'
        ? 'Chaque tonalité dure 4 mesures, puis on monte d’une quarte. Garde la même idée mélodique et transpose-la.'
        : 'IIø7 – V7♭9 – Im6 dans les 12 tonalités, en cycle de quartes.',
    bars
  };
}

/** Débutant : II – V – I en accords de 3 sons, dans les 12 tonalités. */
function cycleTriads(): Chart {
  const order = [0, 5, 10, 3, 8, 1, 6, 11, 4, 9, 2, 7];
  const bars: Bar[] = [];
  for (const pc of order) {
    const key = keyOnPc(pc, 'major');
    const t = key.tonic;
    const tp = pcOf(t);
    const ii: Chord = { root: spellWith(t.letter + 1, tp + 2), quality: 'min' };
    const v: Chord = { root: spellWith(t.letter + 4, tp + 7), quality: 'maj' };
    const i: Chord = { root: t, quality: 'maj' };
    bars.push({ chords: [{ chord: ii, beats: 4 }], section: keyName(key) });
    bars.push({ chords: [{ chord: v, beats: 4 }] });
    bars.push({ chords: [{ chord: i, beats: 4 }] });
    bars.push({ chords: [{ chord: i, beats: 4 }] });
  }
  return {
    id: 'cycle-tri',
    title: 'Débutant : II – V – I en 3 sons',
    subtitle: '12 tonalités, cycle de quartes',
    key: keyOnPc(0, 'major'),
    tempo: 80,
    style: 'swing',
    beatsPerBar: 4,
    level: 1,
    notes: 'Dm G C, puis la même chose une quarte plus haut. Joue les accords en renversements proches : la main bouge à peine.',
    bars
  };
}

const BEGINNER = [
  `title: Débutant : I – VI – IV – V
subtitle: Accords de 3 sons, en C
key: C
tempo: 88
style: ballade
level: 1
notes: Quatre accords majeurs et mineurs : C (I), Am (VI), F (IV), G (V). Joue-les en renversements proches, puis transpose.
[A]
| C | Am | F | G |
| C | Am | F | G |
[B]
| F | G | C | Am |
| Dm | G | C | C |`,
  `title: Débutant : blues 3 accords
subtitle: I, IV, V en 3 sons, 12 mesures
key: C
tempo: 100
style: swing
level: 1
notes: La forme du blues avec seulement C, F et G. Quand elle tourne, passe au blues en F, avec les 7es.
[A]
| C | F | C | C |
| F | F | C | C |
| G | F | C | G |`
];

export const EXERCISES: Chart[] = [
  parseChart(BEGINNER[0], 'debutant-1645'),
  parseChart(BEGINNER[1], 'debutant-blues'),
  cycleTriads(),
  cycle('major'),
  cycle('minor')
];
