import { describe, expect, it } from 'vitest';
import { TERMS, splitTerms, termRegex } from './glossary';
import { LESSONS } from './lessons';
import { parseChord } from '../../core/theory/chords';

const linked = (text: string) => splitTerms(text, new Set()).flatMap((x) => ('term' in x ? [`${x.term.id}:${x.text}`] : []));

describe('lexique', () => {
  it('chaque mot : une définition, une leçon qui existe, des exemples qui se lisent', () => {
    expect(new Set(TERMS.map((t) => t.id)).size).toBe(TERMS.length);
    for (const t of TERMS) {
      expect(() => termRegex(t), t.id).not.toThrow();
      expect(t.text.length, t.id).toBeGreaterThan(40);
      if (t.lesson) expect(LESSONS.some((l) => l.id === t.lesson), `${t.id} → ${t.lesson}`).toBe(true);
      for (const c of t.example?.chords ?? []) expect(parseChord(c), c).not.toBeNull();
    }
  });
  it('trouve les mots dans le texte, une fois chacun, pas au milieu d’un symbole', () => {
    expect(linked('On appelle ça un **shell** : la 3ce et la 7e de la dominante.')).toEqual(['shell:shell', 'tierce:3ce', 'septieme:7e', 'dominante:dominante']);
    expect(linked('Le ii–V sert à changer de tonalité.')).toEqual(['iiVI:ii–V', 'tonalite:tonalité']);
    // Pas dans les accords ni les chiffres romains.
    expect(linked('Cmaj7 IΔ7 Bø7 17e')).toEqual([]);
    const seen = new Set<string>();
    splitTerms('la sensible', seen);
    expect(splitTerms('encore la sensible', seen).every((x) => !('term' in x))).toBe(true);
  });
  it('les leçons du parcours expliquent leurs mots : « shell » et « ii–V » sont touchables dès l’étape 5', () => {
    const ii = LESSONS.find((l) => l.id === 'iiVI')!;
    const seen = new Set<string>();
    for (const b of ii.blocks) if (b.t === 'p' || b.t === 'tip') splitTerms(b.text.replace(/\*\*/g, ''), seen);
    expect([...seen]).toEqual(expect.arrayContaining(['shell', 'iiVI', 'sensible', 'triton', 'tonalite']));
  });
});
