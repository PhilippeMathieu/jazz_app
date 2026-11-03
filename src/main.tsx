import { render } from 'preact';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import { App } from './app';
import { setupInstall, setupUpdates } from './core/app/pwa';
import { onEvent, onGoalReached } from './core/events';
import { markLesson } from './parcours/progress';
import { Toasts, toast } from './ui/Rewards';

setupInstall();
setupUpdates();
// Une leçon lue compte pour le parcours ; l'objectif du jour s'annonce.
onEvent((ev) => {
  if (ev.type === 'lesson') markLesson(ev.id);
});
onGoalReached(() => toast({ kind: 'goal', title: 'Objectif du jour atteint', sub: 'La série continue' }));

render(
  <>
    <App />
    <Toasts />
  </>,
  document.getElementById('app')!
);
