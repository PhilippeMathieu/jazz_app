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

describe('import Ultimate Guitar et ChordPro', () => {
  const UG = `Autumn Leaves chords
Capo: 2nd fret
Tuning: E A D G B E
Key: Am

[Intro]
Dm7  G7  Cmaj7  Fmaj7

[Verse 1]
Dm7               G7
The falling leaves drift by the window
Bm7b5    E7       Am  (x2)
The autumn leaves of red and gold

Am7   x02010
`;

  it('transpose selon le capo et ignore accordage et diagrammes', () => {
    const r = importText(UG);
    expect(r.capo).toBe(2);
    expect(r.capoApplied).toBe(true);
    expect(syms(r)).toEqual(['Em7', 'A7', 'Dmaj7', 'Gmaj7', 'Em7', 'A7', 'C♯ø7', 'F♯7', 'Bm']);
    expect(keyName(r.key)).toBe('Bm');
    expect(r.bars[0].section).toBe('Intro');
  });

  it('peut garder les formes de guitare', () => {
    const r = importText(UG, { applyCapo: false });
    expect(syms(r).slice(0, 2)).toEqual(['Dm7', 'G7']);
    expect(keyName(r.key)).toBe('Am');
  });

  it('lit le format brut [ch]…[/ch]', () => {
    const r = importText('[ch]Dm7[/ch]   [ch]G7[/ch]\nSome words\n[ch]Cmaj7[/ch]');
    expect(syms(r)).toEqual(['Dm7', 'G7', 'Cmaj7']);
  });

  it('lit le ChordPro', () => {
    const r = importText(`{title: Blue Bossa}
{key: Cm}
{tempo: 140}
{soc}
[Cm7]Words here [Fm7]and there
[Dm7b5]More [G7b9]words [Cm7]end`);
    expect(r.title).toBe('Blue Bossa');
    expect(r.tempo).toBe(140);
    expect(syms(r)).toEqual(['Cm7', 'Fm7', 'Dø7', 'G7♭9', 'Cm7']);
    expect(r.bars[0].section).toBe('Refrain');
    expect(keyName(r.key)).toBe('Cm');
  });
});

describe('import : cas limites', () => {
  it('garde les lignes d’un seul accord (D, A, B7…)', () => {
    const r = importText('D\nSome lyrics here\nA\nMore lyrics\nG\nB7\n[B]\nC');
    expect(syms(r)).toEqual(['D', 'A', 'G', 'B7', 'C']);
    expect(r.bars[4].section).toBe('B');
  });
  it('lit les tonalités altérées', () => {
    expect(keyName(importText('Key: F#\nF#  B  C#7').key)).toBe('F♯');
    expect(keyName(importText('Key: Bb\nBb  Eb  F7').key)).toBe('B♭');
  });
  it('répartit plus de 4 accords par mesure sur des temps entiers', () => {
    const r = importText('| C Dm Em F G |');
    expect(r.bars.length).toBe(2);
    for (const b of r.bars) expect(b.chords.every((c) => Number.isInteger(c.beats) && c.beats > 0)).toBe(true);
  });
});

import { LIBRARY } from '../../library/charts';
import { analyze } from '../analysis/analyze';
import { transposeChart, flatten } from './model';

describe('grilles de la bibliothèque', () => {
  it('se relisent à l’identique après enregistrement', () => {
    for (const c of LIBRARY) {
      const back = parseChart(chartToText(c), c.id);
      expect(flatten(back).map((f) => chordSymbol(f.chord))).toEqual(flatten(c).map((f) => chordSymbol(f.chord)));
    }
  });
  it('gardent la même analyse dans les 12 tonalités', () => {
    for (const c of LIBRARY) {
      const ref = analyze(c).chords.map((a) => a.roman);
      for (let s = 1; s < 12; s++) {
        const t = transposeChart(c, s);
        // Une transposition qui écrit B♯, E♯, C♭, F♭ ou des doubles altérations n'est pas comparable (orthographe forcée).
        if (flatten(t).some((f) => Math.abs(f.chord.root.acc) > 1 || /^(B♯|E♯|C♭|F♭)/.test(chordSymbol(f.chord)))) continue;
        expect(analyze(t).chords.map((a) => a.roman), `${c.id} +${s}`).toEqual(ref);
      }
    }
  });
  it('n’échoue pas sur une grille vide', () => {
    expect(analyze(parseChart('key: C')).chords).toEqual([]);
  });
});
