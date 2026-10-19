import { describe, expect, it } from 'vitest';
import { analyze } from './analyze';
import { chartById } from '../../library/charts';
import { flatten, keyName, parseChart, transposeChart } from '../chart/model';
import { chordSymbol } from '../theory/chords';

function table(id: string) {
  const ch = chartById(id)!;
  const a = analyze(ch);
  return flatten(ch).map((f, i) => ({ sym: chordSymbol(f.chord), key: keyName(a.chords[i].key), roman: a.chords[i].roman }));
}
const find = (rows: ReturnType<typeof table>, sym: string, nth = 0) => rows.filter((r) => r.sym === sym)[nth];

describe('analyse harmonique', () => {
  it('Autumn Leaves : ii–V–I en B♭ puis ii–V–i en Gm', () => {
    const t = table('autumn-leaves');
    expect(find(t, 'Cm7')).toMatchObject({ key: 'B♭', roman: 'IIm7' });
    expect(find(t, 'F7')).toMatchObject({ key: 'B♭', roman: 'V7' });
    expect(find(t, 'B♭maj7')).toMatchObject({ key: 'B♭', roman: 'IΔ7' });
    expect(find(t, 'Aø7')).toMatchObject({ key: 'Gm', roman: 'IIø7' });
    expect(find(t, 'D7♭9')).toMatchObject({ key: 'Gm', roman: 'V7♭9' });
    expect(find(t, 'Gm6')).toMatchObject({ key: 'Gm', roman: 'Im6' });
    expect(find(t, 'E♭maj7')).toMatchObject({ key: 'B♭', roman: 'IVΔ7' });
    expect(find(t, 'E♭maj7', 3)).toMatchObject({ key: 'E♭', roman: 'IΔ7' });
  });

  it('All the Things You Are, mesures 24–25 : V7/VI → VIm7 en A♭, pas une modulation', () => {
    const t = table('all-the-things');
    expect(find(t, 'C7♯5')).toMatchObject({ key: 'A♭', roman: 'V7♯5/VI' });
    expect(find(t, 'Fm7', 2)).toMatchObject({ key: 'A♭', roman: 'VIm7' });
  });

  it('Rhythm changes : A♭7 est un backdoor vers B♭', () => {
    const ch = chartById('rhythm-changes')!;
    const a = analyze(ch);
    const i = flatten(ch).findIndex((f) => chordSymbol(f.chord) === 'A♭7');
    expect(a.chords[i].backdoor).toBe(true);
  });

  it('Solar : ii–V qui descendent d’un ton', () => {
    const t = table('solar');
    expect(find(t, 'Gm7')).toMatchObject({ key: 'F', roman: 'IIm7' });
    expect(find(t, 'Fm7')).toMatchObject({ key: 'E♭', roman: 'IIm7' });
    expect(find(t, 'E♭m7')).toMatchObject({ key: 'D♭', roman: 'IIm7' });
    expect(find(t, 'Dø7')).toMatchObject({ key: 'Cm', roman: 'IIø7' });
    expect(find(t, 'Cm(maj7)')).toMatchObject({ key: 'Cm', roman: 'ImΔ7' });
  });

  it('Blues mineur : ♭VI7 – V7 – i', () => {
    const t = table('blues-mineur');
    expect(find(t, 'Fm7')).toMatchObject({ key: 'Cm', roman: 'IVm7' });
    expect(find(t, 'G7♭9')).toMatchObject({ key: 'Cm', roman: 'V7♭9' });
  });

  it('So What : dorien de ré puis de mi♭', () => {
    const t = table('so-what');
    expect(find(t, 'Dm7')).toMatchObject({ key: 'Dm', roman: 'Im7' });
    expect(find(t, 'E♭m7')).toMatchObject({ key: 'E♭m', roman: 'Im7' });
  });

  it('Blue Bossa : modulation en D♭', () => {
    const t = table('blue-bossa');
    expect(find(t, 'E♭m7')).toMatchObject({ key: 'D♭', roman: 'IIm7' });
    expect(find(t, 'A♭7')).toMatchObject({ key: 'D♭', roman: 'V7' });
    expect(find(t, 'Dø7')).toMatchObject({ key: 'Cm', roman: 'IIø7' });
  });

  it('Rhythm changes : dominantes secondaires du pont', () => {
    const t = table('rhythm-changes');
    expect(find(t, 'G7')).toMatchObject({ key: 'B♭', roman: 'V7/II' });
    expect(find(t, 'D7', 1)).toMatchObject({ roman: 'V7/VI' });
    expect(find(t, 'C7', 1)).toMatchObject({ roman: 'V7/V' });
  });

  it('All the Things You Are : centres tonaux successifs', () => {
    const t = table('all-the-things');
    expect(find(t, 'Cmaj7')).toMatchObject({ key: 'C', roman: 'IΔ7' });
    expect(find(t, 'E♭maj7')).toMatchObject({ key: 'E♭', roman: 'IΔ7' });
    expect(find(t, 'Gmaj7')).toMatchObject({ key: 'G', roman: 'IΔ7' });
    expect(find(t, 'Emaj7')).toMatchObject({ key: 'E', roman: 'IΔ7' });
  });

  it('Blues : I7 et IV7 restent dans la tonalité', () => {
    const t = table('blues-f');
    expect(t[0]).toMatchObject({ key: 'F', roman: 'I7' });
    expect(t[1]).toMatchObject({ key: 'F', roman: 'IV7' });
    expect(find(t, 'D7')).toMatchObject({ roman: 'V7/II' });
  });

  it('substitution tritonique', () => {
    const ch = parseChart('key: C\n| Dm7 | D♭7 | Cmaj7 | Cmaj7 |');
    const a = analyze(ch);
    expect(a.chords[1].roman).toBe('SubV7');
    expect(a.brackets[0].kind).toBe('iiSubV');
  });

  it('la transposition garde l’analyse', () => {
    const ch = transposeChart(chartById('autumn-leaves')!, 2);
    expect(keyName(ch.key)).toBe('Am');
    const a = analyze(ch);
    expect(a.chords[2].roman).toBe('IΔ7');
    expect(keyName(a.chords[2].key)).toBe('C');
  });
});
