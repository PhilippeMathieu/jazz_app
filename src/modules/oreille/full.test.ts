import { describe, expect, it } from 'vitest';
import { parseNote, pcOf } from '../../core/theory/notes';
import { chordSymbol } from '../../core/theory/chords';
import { recordAnswer, confusions } from '../../core/confusions';
import { FULL_TONAL, itemOfAnswer, judgeFull, makeFullDuel, makeFullQuestion, pcNameIn } from './full';

const key = (s: string) => ({ tonic: parseNote(s)!.note, mode: 'major' as const });

describe('Accord entier', () => {
  it('noms des notes dans la tonalité', () => {
    expect(pcNameIn(5, key('Eb'))).toBe('F');
    expect(pcNameIn(10, key('Eb'))).toBe('B♭');
    expect(pcNameIn(6, key('D'))).toBe('F♯');
    expect(pcNameIn(4, key('Eb'))).toBe('E');
    expect(pcNameIn(11, key('Eb'))).toBe('B');
    expect(pcNameIn(1, key('A'))).toBe('C♯');
    expect(pcNameIn(10, key('C'))).toBe('B♭');
    expect(pcNameIn(1, null)).toBe('D♭');
  });
  it('dans une tonalité : accords de la gamme, bien orthographiés', () => {
    for (let i = 0; i < 50; i++) {
      const q = makeFullQuestion(1, {}, []);
      expect(q.key).not.toBeNull();
      expect(FULL_TONAL[1].map((x) => x.id)).toContain(q.item!.id);
      // La fondamentale porte la lettre du degré : pas de A♯ en B♭.
      expect(chordSymbol(q.chord)).not.toMatch(/♯♯|♭♭/);
      expect(q.qualities).toContain(q.chord.quality);
    }
  });
  it('libre : référence = do, pas de tonalité', () => {
    const q = makeFullQuestion(3, {}, []);
    expect(q.key).toBeNull();
    expect(q.ref).toEqual([60]);
  });
  it('correction : juste, nature seule, fondamentale seule', () => {
    const q = makeFullQuestion(1, {}, [], undefined, () => 0.01);
    const root = pcOf(q.chord.root);
    expect(judgeFull(q, { root, quality: q.chord.quality }).ok).toBe(true);
    const wrongRoot = judgeFull(q, { root: (root + 2) % 12, quality: q.chord.quality });
    expect(wrongRoot.qualityOk && !wrongRoot.rootOk).toBe(true);
    expect(wrongRoot.text).toContain('La nature est juste');
    const other = q.qualities.find((x) => x !== q.chord.quality)!;
    expect(judgeFull(q, { root, quality: other }).text).toContain('La fondamentale est juste');
  });
  it('confusions de degrés et duel', () => {
    const k = key('C');
    expect(itemOfAnswer(k, { root: 2, quality: 'm7' })?.id).toBe('IIm7');
    let s = recordAnswer('degre', 'IIm7', 'IVΔ7', [], {});
    s = recordAnswer('degre', 'IVΔ7', 'IIm7', [], s);
    const d = makeFullDuel(confusions('degre', s))!;
    expect(d.duel).toHaveLength(2);
    expect(['IIm7', 'IVΔ7']).toContain(d.item!.id);
  });
});
