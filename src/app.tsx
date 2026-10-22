// Les écrans : le parcours (accueil, étape, leçon, exercice), l'accès libre (morceaux, clavier) et les réglages.
import { useRoute, go } from './ui/router';
import { Home } from './parcours/Home';
import { StepView } from './parcours/StepView';
import { ActivityView } from './parcours/ActivityView';
import { Settings } from './parcours/Settings';
import { STEPS, stepById } from './parcours/steps';
import { loadParcours, nextInStep } from './parcours/progress';
import { pathOf } from './parcours/ui';
import { LessonView } from './modules/cours/Cours';
import { OreilleRun, OreilleMode } from './modules/oreille/Oreille';
import { ChartList } from './modules/grilles/ChartList';
import { ChartView } from './modules/grilles/ChartView';
import { Import } from './modules/grilles/Import';
import { Clavier } from './modules/clavier/Clavier';
import { Micro } from './modules/micro/Micro';
import { Calibrate } from './modules/reglages/Calibrate';
import { RythmeRun } from './modules/rythme/Rythme';
import { chartById } from './library/charts';
import { lessonById } from './modules/cours/lessons';

export function App() {
  const [page, a, b] = useRoute();
  if (page === 'etape' && a) return <StepView key={a} id={a} />;
  if (page === 'x' && a) return <ActivityView id={a} />;
  if (page === 'lecon' && a && b) {
    const step = stepById(a);
    const lessonIdx = step ? step.lessons.indexOf(b) : -1;
    if (step && lessonById(b))
      return (
        <LessonView
          key={b}
          id={b}
          where={`Étape ${STEPS.indexOf(step) + 1} · leçon ${lessonIdx + 1}/${step.lessons.length}`}
          onBack={() => go(`/etape/${a}`)}
          // Leçon lue : la suite de l'étape (la leçon suivante, ou le premier exercice).
          onDone={() => {
            const next = nextInStep(loadParcours(), step);
            go(next ? pathOf(next) : `/etape/${a}`);
          }}
        />
      );
  }
  if (page === 'revoir' && (a === 'rythme' || a === 'style')) return <RythmeRun key={a} exercise={a === 'rythme' ? 'oreille' : 'style'} level={1} duel onExit={() => go('/')} />;
  if (page === 'revoir' && a) return <OreilleRun key={a} mode={a as OreilleMode} level={4} duel onExit={() => go('/')} />;
  if (page === 'morceaux') return <ChartList />;
  if (page === 'importer') return <Import />;
  if (page === 'grille') {
    const c = a ? chartById(a) : undefined;
    return c ? <ChartView key={c.id + (b ?? '')} chart={c} initialMode={b === 'analyser' ? 'analyser' : undefined} /> : <ChartList />;
  }
  if (page === 'clavier') return <Clavier />;
  if (page === 'reglages') {
    if (a === 'micro') return <Micro />;
    if (a === 'decalage') return <Calibrate key={b} input={b === 'ecran' ? 'tap' : 'mic'} onDone={() => go('/reglages')} />;
    return <Settings />;
  }
  return <Home />;
}
