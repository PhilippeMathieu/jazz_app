// Branche le jeu sur le reste de l'appli : badge « confusion vaincue », pistes pour les défis du jour.
import { confusions, onConfusionGone } from '../confusions';
import { EXOS, loadGame, report, setChallengeHints } from '../game';
import { QUALITIES } from '../theory/chords';
import { PROGRESSIONS } from '../theory/progressions';
import { GROOVES, StyleId } from '../rhythm/styles';
import { LESSONS } from '../../modules/cours/lessons';
import { coursProgress } from '../../modules/cours/Cours';
import { LIBRARY } from '../../library/charts';

const qual = (k: string) => (k === 'maj' ? 'majeur' : k === 'min' ? 'mineur' : QUALITIES[k]?.sym ?? k);

export function setupGame() {
  onConfusionGone(() => report({ type: 'confusionGone' }));
  setChallengeHints(() => {
    const g = loadGame();
    // L'exercice le moins réussi récemment (au moins 10 réponses), sinon celui du jour.
    let weak: { exo: string; acc: number } | null = null;
    for (const [key, r] of Object.entries(g.recent)) {
      const exo = key.split(':')[0];
      if (!EXOS[exo] || r.length < 10) continue;
      const acc = r.reduce((a, b) => a + b, 0) / r.length;
      if (!weak || acc < weak.acc) weak = { exo, acc };
    }
    const accord = confusions('accord')[0];
    const degre = confusions('degre')[0];
    const style = confusions('style')[0];
    const prog = confusions('prog')[0];
    const duel = accord
      ? { text: `Oreille, ${qual(accord.a)} ou ${qual(accord.b)}`, href: '#/oreille/confusions' }
      : degre
        ? { text: `Oreille, ${degre.a} ou ${degre.b}`, href: '#/oreille/confusions' }
        : prog
          ? { text: `Oreille, ${PROGRESSIONS[prog.a]?.name} ou ${PROGRESSIONS[prog.b]?.name}`, href: '#/oreille/confusions' }
          : style
            ? { text: `Styles, ${GROOVES[style.a as StyleId]?.name} ou ${GROOVES[style.b as StyleId]?.name}`, href: '#/rythme/style/confusions' }
            : undefined;
    const notAnalysed = LIBRARY.filter((c) => !g.standards[c.id]?.analyse);
    const day = new Date().getDate();
    const chart = notAnalysed.length ? notAnalysed[day % notAnalysed.length] : undefined;
    return {
      weakExo: weak && weak.acc < 0.9 ? { exo: weak.exo, name: EXOS[weak.exo].name, href: EXOS[weak.exo].href } : undefined,
      duel,
      lessonLeft: coursProgress().read.length < LESSONS.length,
      chart: chart ? { title: chart.title, href: `#/grille/${chart.id}/analyser` } : undefined
    };
  });
}
