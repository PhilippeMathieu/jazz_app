import { describe, expect, it } from 'vitest';
import { confusionWeight, confusions, recordAnswer, rivalsOf } from './confusions';
import { makeDuelQuestion, makeEarQuestion, progChoices } from '../modules/oreille/questions';

describe('confusions', () => {
  it('une paire apparaît après 2 erreurs et disparaît avec les bonnes réponses', () => {
    let s = recordAnswer('accord', 'm7', 'm7b5', ['m7', 'm7b5', '7'], {});
    expect(confusions('accord', s)).toHaveLength(0);
    s = recordAnswer('accord', 'm7b5', 'm7', ['m7', 'm7b5'], s);
    const p = confusions('accord', s);
    expect(p).toHaveLength(1);
    expect(rivalsOf(p, 'm7')).toEqual(['m7b5']);
    // 4 bonnes réponses avec le rival proposé : 2 erreurs - 4/2 = 0, la paire disparaît.
    for (let i = 0; i < 4; i++) s = recordAnswer('accord', 'm7', 'm7', ['m7', 'm7b5'], s);
    expect(confusions('accord', s)).toHaveLength(0);
  });
  it('les éléments confondus reviennent plus souvent', () => {
    let s = {};
    for (let i = 0; i < 3; i++) s = recordAnswer('accord', 'maj7', '7', ['maj7', '7', 'm7'], s);
    const pairs = confusions('accord', s);
    expect(confusionWeight(pairs, 'maj7')).toBeGreaterThan(confusionWeight(pairs, 'm7'));
    let n = 0;
    for (let i = 0; i < 400; i++) if ((makeEarQuestion('ear', 1, {}, undefined, Math.random, pairs) as { q: string }).q !== 'm7') n++;
    // maj7 et 7 : plus des 2/3 des questions.
    expect(n / 400).toBeGreaterThan(0.7);
  });
  it('duel : la bonne réponse et sa rivale seulement', () => {
    let s = {};
    for (let i = 0; i < 2; i++) s = recordAnswer('accord', 'maj7', '6', ['maj7', '6'], s);
    const q = makeDuelQuestion('ear', confusions('accord', s), 3)!;
    expect(q.mode).toBe('ear');
    if (q.mode === 'ear') expect([...(q.choices ?? [])].sort()).toEqual(['6', 'maj7']);
  });
  it('progressions : la rivale fait partie des choix', () => {
    for (let i = 0; i < 20; i++) expect(progChoices('turn1', 1, Math.random, ['turn3'])).toContain('turn3');
  });
});
