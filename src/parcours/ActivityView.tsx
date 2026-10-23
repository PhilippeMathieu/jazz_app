// Un exercice du parcours : l'objectif, l'exercice lui-même (une brique lancée directement), puis le résultat.
import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../core/audio/engine';
import { onEvent } from '../core/events';
import { useMicState } from '../core/listen/mic';
import { TopBar } from '../ui/Screen';
import { MicPill } from '../ui/MicPill';
import { toast } from '../ui/Rewards';
import { go } from '../ui/router';
import { Activity, Goal, STEPS, Step, activityById, goalText } from './steps';
import { loadParcours, nextInStep, recordActivity, stepState } from './progress';
import { renderRun } from './runners';
import { rythmeHow } from '../modules/rythme/Rythme';
import { WHERE_LABEL, hrefOf, stepNo } from './ui';

/** Comment faire, pour les exercices qui se passent sur un morceau. */
const HOW: Partial<Record<string, string>> = {
  analyser: 'Le quiz du morceau : pour chaque phrase, écoute-la et dis ce qui s’y passe. L’explication s’affiche après chaque réponse. Tu peux d’abord lire « Comprendre ».',
  memoire: 'Des accords sont cachés : retrouve chacun parmi 4 choix.',
  guide: 'Active le micro, lance la lecture, et joue la 3ce ou la 7e de chaque accord sur le 1er temps. Arrête la lecture pour avoir le résultat.',
  gammes: 'Active le micro, lance la lecture, et improvise : vise une note de l’accord sur chaque 1er temps. Arrête la lecture pour avoir le résultat.',
  analyse: 'Active le micro, lance la lecture, et accompagne : la 3ce et la 7e de chaque accord. Arrête la lecture pour avoir le résultat.'
};

/** Exercices d'oreille (écouteurs conseillés). */
const EAR = ['ear', 'full', 'iv', 'bass'];

interface Outcome {
  passed: boolean;
  /** Ce qui a été obtenu, en mots. */
  text: string;
  best: number;
  self?: boolean;
}

export function ActivityView({ id }: { id: string }) {
  const found = activityById(id);
  if (!found) return null;
  return <ActivityRun key={id} step={found.step} act={found.act} />;
}

function ActivityRun({ step, act }: { step: Step; act: Activity }) {
  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [count, setCount] = useState({ n: 0, ok: 0 });
  const [out, setOut] = useState<Outcome | null>(null);
  const [runKey, setRunKey] = useState(0);
  const counter = useRef({ n: 0, ok: 0 });
  const finished = useRef(false);
  const mic = useMicState();
  const goal = act.goal;
  const back = () => go(`/etape/${step.id}`);

  const finish = (o: Outcome) => {
    if (finished.current) return;
    finished.current = true;
    const wasComplete = stepState(loadParcours(), step).complete;
    const first = recordActivity(act.id, o.best, o.passed, !!o.self);
    if (first) {
      const nowComplete = stepState(loadParcours(), step).complete;
      if (nowComplete && !wasComplete) toast({ kind: 'step', title: `Étape ${stepNo(step)} terminée`, sub: step.title });
      else toast({ kind: 'ok', title: 'Exercice validé', sub: act.title });
    }
    setOut(o);
    setPhase('done');
  };

  // Pendant l'exercice : on compte ce que la brique envoie.
  useEffect(() => {
    if (phase !== 'run') return;
    counter.current = { n: 0, ok: 0 };
    finished.current = false;
    setCount({ n: 0, ok: 0 });
    const run = act.run;
    return onEvent((ev) => {
      if (goal.kind === 'answers' && ev.type === 'answer') {
        const c = counter.current;
        if (c.n >= goal.n) return;
        c.n++;
        if (ev.ok) c.ok++;
        setCount({ ...c });
        if (c.n >= goal.n) finish({ passed: c.ok >= goal.min, best: c.ok, text: `${c.ok} ${goal.takes ? 'réussi' : 'juste'}${c.ok > 1 ? 's' : ''} sur ${goal.n}` });
      } else if (run.kind === 'chart' && 'chart' in ev && ev.chart === run.chart) {
        if (goal.kind === 'analyse' && ev.type === 'analyse') {
          const r = ev.total ? ev.found / ev.total : 0;
          finish({ passed: r >= goal.ratio, best: Math.round(r * 100), text: `${ev.found} phrase${ev.found > 1 ? 's' : ''} reconnue${ev.found > 1 ? 's' : ''} sur ${ev.total}` });
        } else if (goal.kind === 'listen' && ev.type === 'listen' && ev.mode === (run.mode === 'guide' || run.mode === 'gammes' ? run.mode : 'analyse') && ev.chords >= goal.chords) {
          finish({ passed: ev.ratio >= goal.ratio, best: Math.round(ev.ratio * 100), text: `${Math.round(ev.ratio * 100)} % sur ${ev.chords} accords` });
        } else if (goal.kind === 'memoire' && ev.type === 'memoire' && ev.level === (run.memLevel ?? ev.level)) {
          const r = ev.total ? ev.ok / ev.total : 0;
          finish({ passed: r >= goal.ratio, best: Math.round(r * 100), text: `${ev.ok} accords retrouvés sur ${ev.total}` });
        }
      }
    });
  }, [phase, runKey]);

  const start = () => {
    audio();
    setOut(null);
    setRunKey((k) => k + 1);
    setPhase('run');
  };
  const prev = loadParcours().acts[act.id];

  if (phase === 'run') {
    const total = goal.kind === 'answers' ? goal.n : 0;
    return (
      <div class="mission">
        <MissionBar goal={goal} count={count} piano={act.where === 'piano'} mic={mic === 'on'} onSelf={() => finish({ passed: true, best: 0, text: 'Validé par toi, sans micro', self: true })} />
        <div key={runKey}>{renderRun(act.run, total, back, act.where)}</div>
      </div>
    );
  }

  if (phase === 'done' && out) {
    const p = loadParcours();
    const next = nextInStep(p, step) ?? null;
    const following = next ? hrefOf(next) : stepState(p, step).complete && STEPS[STEPS.indexOf(step) + 1] ? `#/etape/${STEPS[STEPS.indexOf(step) + 1].id}` : `#/etape/${step.id}`;
    return (
      <div class="screen act-done">
        <TopBar title={act.title} onBack={back} />
        <div class={'result-card ' + (out.passed ? 'ok' : 'bad')}>
          <b>{out.passed ? 'Validé' : 'Pas encore'}</b>
          <span>{out.text}</span>
          <span class="muted small">Objectif : {goalText(goal)}</span>
        </div>
        <div class="row-actions">
          <button class="btn" onClick={start}>
            Recommencer
          </button>
          {out.passed ? (
            <a class="btn primary grow" href={following}>
              Continuer
            </a>
          ) : (
            <button class="btn primary grow" onClick={back}>
              Retour à l’étape
            </button>
          )}
        </div>
        {!out.passed ? <p class="muted small">Relis la leçon de l’étape si besoin : les erreurs reviennent plus souvent la fois suivante.</p> : null}
      </div>
    );
  }

  return (
    <div class="screen act-intro">
      <TopBar title={`Étape ${stepNo(step)}`} onBack={back} actions={act.where === 'piano' ? <MicPill echo={act.run.kind === 'comping'} /> : undefined} />
      <span class={'where-tag ' + act.where}>{WHERE_LABEL[act.where]}</span>
      <h1 class="step-title">{act.title}</h1>
      <p class="intro">{act.sub}.</p>
      {act.run.kind === 'chart' && HOW[act.run.mode] ? <p class="ls-p">{HOW[act.run.mode]}</p> : null}
      {act.run.kind === 'rythme' ? (
        <ol class="howto">
          {rythmeHow(act.run.exercise).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      ) : null}
      <div class="goal-box">
        <span class="label">Objectif</span>
        <b>{goalText(goal)}</b>
        {prev ? <span class="muted small">{prev.passed ? (prev.self ? 'Déjà validé (sans micro).' : 'Déjà validé.') : 'Pas encore validé.'}</span> : null}
      </div>
      {act.where === 'piano' ? (
        <p class="muted small">
          {mic === 'on' ? 'Le micro écoute ton piano.' : 'Active le micro (en haut à droite) : il valide ce que tu joues. Sans micro, tu pourras valider toi-même.'}
          {act.run.kind === 'comping' || act.run.kind === 'phrase' ? ' Mets un écouteur : sinon le micro entend l’accompagnement.' : ''}
        </p>
      ) : EAR.includes(act.run.kind) || (act.run.kind === 'rythme' && (act.run.exercise === 'oreille' || act.run.exercise === 'style')) ? (
        <p class="muted small">Avec des écouteurs : c’est un exercice d’oreille.</p>
      ) : act.run.kind === 'rythme' ? (
        <p class="muted small">Tape la grande zone en bas de l’écran, avec un doigt. Le décalage du téléphone se règle une fois, au premier exercice (10 secondes).</p>
      ) : null}
      <div class="thumb-zone">
        <button class="btn primary block" onClick={start}>
          Commencer
        </button>
      </div>
    </div>
  );
}

/** Bandeau de l'objectif, au-dessus de l'exercice. */
function MissionBar({ goal, count, piano, mic, onSelf }: { goal: Goal; count: { n: number; ok: number }; piano: boolean; mic: boolean; onSelf: () => void }) {
  const [ask, setAsk] = useState(false);
  return (
    <div class="mission-bar">
      {goal.kind === 'answers' ? (
        <>
          <span class="mission-dots" aria-label={`${count.n} sur ${goal.n}`}>
            {Array.from({ length: Math.min(goal.n, 20) }, (_, i) => (
              <i key={i} class={i < Math.round((count.n / goal.n) * Math.min(goal.n, 20)) ? 'on' : ''} />
            ))}
          </span>
          <span class="mission-text">
            {count.ok} {goal.takes ? 'réussi' : 'juste'}
            {count.ok > 1 ? 's' : ''} · objectif {goal.min}/{goal.n}
          </span>
        </>
      ) : (
        <span class="mission-text">Objectif : {goalText(goal)}</span>
      )}
      {piano && !mic ? (
        ask ? (
          <span class="mission-self">
            Joué correctement ?{' '}
            <button class="btn sm" onClick={onSelf}>
              Oui, valider
            </button>
          </span>
        ) : (
          <button class="btn ghost sm" onClick={() => setAsk(true)}>
            Sans micro
          </button>
        )
      ) : null}
    </div>
  );
}
