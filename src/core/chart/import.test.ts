import { describe, expect, it } from 'vitest';
import { chartFromImport, importText } from './import';
import { chartToText, keyName, parseChart } from './model';
import { QUALITIES, chordSymbol, chordOnPc, parseChord } from '../theory/chords';

const syms = (r: ReturnType<typeof importText>) => r.bars.map((b) => b.chords.map((c) => chordSymbol(c.chord)).join(' '));

describe('import de grilles', () => {
  it('lit les accords au-dessus des paroles', () => {
    const r = importText(`
[Intro]
Am7  D7  Gmaj7  Cmaj7

[Verse 1]
Am7             D7
The falling leaves drift by the window
F#m7b5   B7(b9)   Em
The autumn leaves of red and gold
`);
    expect(syms(r)).toEqual(['Am7', 'D7', 'Gmaj7', 'Cmaj7', 'Am7', 'D7', 'F♯ø7', 'B7♭9', 'Em']);
    expect(r.bars[0].section).toBe('Intro');
    expect(r.bars[4].section).toBe('Verse');
    expect(keyName(r.key)).toBe('Em');
    expect(r.measured).toBe(false);
  });

  it('respecte les barres de mesure et les répétitions', () => {
    const r = importText('| Dm7 G7 | Cmaj7 | % |\n| A7(b9) |');
    expect(syms(r)).toEqual(['Dm7 G7', 'Cmaj7', 'Cmaj7', 'A7♭9']);
    expect(r.measured).toBe(true);
    expect(keyName(r.key)).toBe('C');
  });

  it('comprend les notations brésiliennes et françaises', () => {
    const r = importText('C7M  Am7(9)  Dm7  G7(13)\nE7(#9)  A7M');
    expect(syms(r)).toEqual(['Cmaj7', 'Am9', 'Dm7', 'G13', 'E7♯9', 'Amaj7']);
  });

  it('ignore les paroles et signale les symboles inconnus', () => {
    const r = importText('A day in the life\nC  G7xyz  F\n');
    expect(syms(r)).toEqual(['C', 'F']);
    expect(r.unknown).toContain('G7xyz');
  });

  it('la grille importée se relit après enregistrement', () => {
    const r = importText('| Dm7 | G7 | Cmaj7 | Cmaj7 |');
    const chart = chartFromImport(r, { id: 'u-test', title: 'Test' });
    const back = parseChart(chartToText(chart), 'u-test');
    expect(back.bars.length).toBe(4);
    expect(keyName(back.key)).toBe('C');
  });

  it('tous les symboles affichés se relisent', () => {
    for (const q of Object.keys(QUALITIES)) {
      const c = chordOnPc(3, q);
      const s = chordSymbol(c);
      expect(parseChord(s)?.quality, s).toBe(q);
    }
  });
});
