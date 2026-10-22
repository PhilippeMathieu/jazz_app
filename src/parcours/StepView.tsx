// Une étape : ce qu'on saura faire, les leçons, les exercices (métro, piano), pour aller plus loin.
import { TopBar } from '../ui/Screen';
import { ChevronIcon } from '../ui/icons';
import { Activity, STEPS, goalText, stepById } from './steps';
import { Parcours, nextInStep, stepState, useParcours } from './progress';
import { Check, hrefOf, lessonTitle, stepNo } from './ui';
import { lessonById } from '../modules/cours/lessons';

function ActRow({ a, p }: { a: Activity; p: Parcours }) {
  const st = p.acts[a.id];
  return (
    <a class="row" href={`#/x/${a.id}`}>
      <Check state={st?.passed ? 'done' : 'todo'} />
      <span class="row-main">
        <span class="row-title">{a.title}</span>
        <span class="row-sub">
          {a.sub} · {st?.passed ? (st.self ? 'validé sans micro' : 'validé') : `objectif : ${goalText(a.goal)}`}
        </span>
      </span>
      <ChevronIcon />
    </a>
  );
}

export function StepView({ id }: { id: string }) {
  const p = useParcours();
  const step = stepById(id);
  if (!step) return null;
  const st = stepState(p, step);
  const n = stepNo(step);
  const req = step.activities.filter((a) => !a.optional);
  const rythme = req.filter((a) => a.run.kind === 'rythme');
  const metro = req.filter((a) => a.where === 'metro' && !rythme.includes(a));
  const piano = req.filter((a) => a.where === 'piano' && !rythme.includes(a));
  const extra = step.activities.filter((a) => a.optional);
  const inStep = nextInStep(p, step);
  const nextStep = STEPS[STEPS.indexOf(step) + 1];
  return (
    <div class="screen step">
      <TopBar title={`Étape ${n} / ${STEPS.length}`} />
      <h1 class="step-title">{step.title}</h1>
      <p class="intro">{step.aim}</p>
      <div class="step-progress" aria-label={`${st.done} sur ${st.total}`}>
        <i style={`width:${Math.round((st.done / st.total) * 100)}%`} />
      </div>
      {st.assumed ? <p class="muted small">Étape acquise d’après ton point de départ : refais ce que tu veux.</p> : null}
      {inStep ? (
        <a class="btn primary block" href={hrefOf(inStep)}>
          {st.done ? 'Continuer' : 'Commencer'} : {inStep.kind === 'lesson' ? lessonTitle(inStep.id) : inStep.act.title}
        </a>
      ) : st.complete && nextStep ? (
        <a class="btn primary block" href={`#/etape/${nextStep.id}`}>
          Étape suivante : {nextStep.title}
        </a>
      ) : null}

      <section>
        <h2 class="label">Comprendre</h2>
        <div class="list">
          {step.lessons.map((l) => (
            <a key={l} class="row" href={`#/lecon/${step.id}/${l}`}>
              <Check state={p.lessons.includes(l) ? 'done' : 'todo'} />
              <span class="row-main">
                <span class="row-title">{lessonTitle(l)}</span>
                <span class="row-sub">
                  Leçon · {lessonById(l)?.minutes ?? 3} min
                </span>
              </span>
              <ChevronIcon />
            </a>
          ))}
          {step.tips?.length ? (
            <a class="row" href={`#/astuces/${step.id}`}>
              <span class="check-none" />
              <span class="row-main">
                <span class="row-title">Astuces d’enchaînement</span>
                <span class="row-sub">
                  {step.tips.length} réflexe{step.tips.length > 1 ? 's' : ''} à écouter et à jouer · facultatif
                </span>
              </span>
              <ChevronIcon />
            </a>
          ) : null}
        </div>
      </section>

      {metro.length ? (
        <section>
          <h2 class="label">Dans le métro</h2>
          <div class="list">
            {metro.map((a) => (
              <ActRow key={a.id} a={a} p={p} />
            ))}
          </div>
        </section>
      ) : null}

      {piano.length ? (
        <section>
          <h2 class="label">Au piano</h2>
          <div class="list">
            {piano.map((a) => (
              <ActRow key={a.id} a={a} p={p} />
            ))}
          </div>
        </section>
      ) : null}

      {rythme.length ? (
        <section>
          <h2 class="label">Rythme</h2>
          <div class="list">
            {rythme.map((a) => (
              <ActRow key={a.id} a={a} p={p} />
            ))}
          </div>
        </section>
      ) : null}

      {extra.length ? (
        <section>
          <h2 class="label">Pour aller plus loin</h2>
          <div class="list">
            {extra.map((a) => (
              <ActRow key={a.id} a={a} p={p} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
