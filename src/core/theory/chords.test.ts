import { describe, expect, it } from 'vitest';
import { chordNotes, chordOnPc, chordSymbol, parseChord } from './chords';
import { noteName } from './notes';

const notes = (s: string) => chordNotes(parseChord(s)!).map(noteName).join(' ');

describe('accords', () => {
  it('parse les notations courantes', () => {
    expect(parseChord('Bb-7')?.quality).toBe('m7');
    expect(parseChord('EbΔ7')?.quality).toBe('maj7');
    expect(parseChord('F#m7b5')?.quality).toBe('m7b5');
    expect(parseChord('C°7')?.quality).toBe('dim7');
    expect(parseChord('G7alt')?.quality).toBe('7alt');
    expect(parseChord('Cm(maj7)')?.quality).toBe('mM7');
    expect(parseChord('C6/9')?.quality).toBe('69');
    expect(chordSymbol(parseChord('C/E')!)).toBe('C/E');
    expect(parseChord('H7')).toBeNull();
  });
  it('orthographie correctement', () => {
    expect(notes('C°7')).toBe('C E♭ G♭ B𝄫');
    expect(notes('E♭m7')).toBe('E♭ G♭ B♭ D♭');
    expect(notes('F♯ø7')).toBe('F♯ A C E');
    expect(notes('D♭7')).toBe('D♭ F A♭ C♭');
  });
  it('choisit l’orthographe la plus lisible', () => {
    expect(chordSymbol(chordOnPc(1, 'maj7'))).toBe('D♭maj7');
    expect(chordSymbol(chordOnPc(1, 'm7'))).toBe('C♯m7');
  });
});
