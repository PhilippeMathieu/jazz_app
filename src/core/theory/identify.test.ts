import { describe, expect, it } from 'vitest';
import { identify, intervalName } from './identify';

const first = (m: number[]) => identify(m)[0];
const names = (m: number[]) => identify(m).slice(0, 4).map((r) => r.symbol);

describe('nommer les notes jouées', () => {
  it('accords de 3 sons et renversements', () => {
    expect(first([60, 64, 67]).symbol).toBe('C');
    expect(first([57, 60, 64]).symbol).toBe('Am');
    const inv = first([64, 67, 72]);
    expect(inv.symbol).toBe('C/E');
    expect(inv.detail).toBe('1er renversement');
    expect(first([67, 72, 76]).detail).toBe('2e renversement');
    expect(first([59, 62, 65]).symbol).toBe('B°');
  });
  it('accords de 4 sons', () => {
    expect(first([60, 64, 67, 71]).symbol).toBe('Cmaj7');
    expect(first([62, 65, 69, 72]).symbol).toBe('Dm7');
    expect(first([55, 59, 62, 65]).symbol).toBe('G7');
    expect(first([59, 62, 65, 69]).symbol).toBe('Bø7');
    expect(first([59, 62, 65, 68]).symbol).toBe('B°7');
  });
  it('sans quinte, sans fondamentale, lectures concurrentes', () => {
    const shell = first([55, 59, 65]);
    expect(shell.symbol).toBe('G7');
    expect(shell.detail).toBe('sans quinte');
    // E G B D : Em7 d'abord, mais aussi Cmaj9 sans fondamentale.
    expect(names([64, 67, 71, 74])[0]).toBe('Em7');
    expect(identify([64, 67, 71, 74]).some((r) => r.symbol === 'Cmaj9' && r.detail === 'sans fondamentale')).toBe(true);
    // A C E G : Am7 d'abord, C6/A ensuite.
    expect(names([57, 60, 64, 67])[0]).toBe('Am7');
    expect(names([57, 60, 64, 67])).toContain('C6/A');
  });
  it('moins de 3 notes : intervalle', () => {
    expect(identify([60, 64])).toHaveLength(0);
    expect(intervalName(60, 64)).toBe('tierce majeure');
    expect(intervalName(60, 67)).toBe('quinte');
    expect(intervalName(60, 72)).toBe('octave');
  });
});
