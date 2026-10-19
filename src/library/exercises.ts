import { Bar, Chart, keyName, keyOnPc } from '../core/chart/model';
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

export const EXERCISES: Chart[] = [cycle('major'), cycle('minor')];
