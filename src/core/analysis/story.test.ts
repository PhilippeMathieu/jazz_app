import { describe, expect, it } from 'vitest';
import { LIBRARY, POP, chartById } from '../../library/charts';
import { improvPlan } from './improv';
import { answerById, storyOf } from './story';
import { quizOf } from '../../modules/grilles/Story';

const story = (id: string) => {
  const c = chartById(id)!;
  const p = improvPlan(c);
  return storyOf(c, p.flat, p.analysis, p.scales);
};

describe('comprendre un morceau', () => {
  it('chaque grille est racontée en entier, phrase par phrase', () => {
    for (const c of [...LIBRARY, ...POP]) {
      const s = story(c.id);
      expect(s.phrases[0].from, c.id).toBe(0);
      expect(s.phrases[s.phrases.length - 1].to, c.id).toBe(c.bars.length - 1);
      s.phrases.forEach((p, i) => {
        if (i) expect(p.from, c.id).toBe(s.phrases[i - 1].to + 1);
        expect(p.title.length, c.id).toBeGreaterThan(3);
        if (p.same === undefined) expect(p.text.length, `${c.id} ${i}`).toBeGreaterThan(15);
        expect(answerById(p.answer), `${c.id} ${p.answer}`).toBeTruthy();
      });
    }
  });
  it('les suites de la pop et du rock sont reconnues', () => {
    expect(story('let-it-be').phrases[0].answer).toBe('n:I-V-vi-IV');
    expect(story('still-loving-you').phrases.find((p) => p.section === 'Refrain')!.answer).toBe('n:i-bVI-bIII-bVII');
    expect(story('la-boheme').phrases[0].answer).toBe('n:i-iv-V-i');
    expect(story('wind-of-change').phrases.some((p) => p.tag === 'sec' && p.text.includes('E7'))).toBe(true);
    expect(story('je-laime-a-mourir').phrases[0].answer).toBe('n:I-iii-vi-ii');
    expect(story('autumn-leaves').phrases[0].tag).toBe('iiVI');
  });
  it('le quiz : la bonne réponse parmi les choix, et aucune autre réponse juste', () => {
    for (const c of [...LIBRARY, ...POP]) {
      const s = story(c.id);
      for (const q of quizOf(s, c.genre ?? 'jazz', 3)) {
        expect(q.choices, c.id).toContain(q.phrase.answer);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        for (const x of q.choices) if (x !== q.phrase.answer) expect(q.phrase.truths, `${c.id} ${x}`).not.toContain(x);
      }
    }
  });
});
