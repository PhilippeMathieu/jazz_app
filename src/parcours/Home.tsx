// Accueil : la prochaine chose à faire, le parcours en 10 étapes, et l'accès libre (morceaux, clavier).
import { useEffect, useState } from 'preact/hooks';
import { canInstall, install, onInstallChange } from '../core/app/pwa';
import { ChevronIcon, SlidersIcon } from '../ui/icons';
import { Segmented } from '../ui/Segmented';
import { confusionsFor, oreilleItemName } from '../modules/oreille/Oreille';
import { confusions } from '../core/confusions';
import { rhythmById } from '../core/rhythm/patterns';
import { GROOVES, StyleId } from '../core/rhythm/styles';
import { goalText, PLACEMENTS, STEPS, Where } from './steps';
import { nextItem, pianoWaiting, setStart, setWhere, stepState, useParcours } from './progress';
import { Check, DayLine, WHERE_LABEL, hrefOf, lessonTitle, stepNo } from './ui';

export function Home() {
  const p = useParcours();
  if (p.start < 0) return <Placement />;
  const next = nextItem(p, p.where);
  const nextStep = next?.step ?? null;
  const waiting = p.where === 'metro' ? pianoWaiting(p) : 0;
  return (
    <div class="screen home">
      <header class="home-head">
        <div>
          <p class="eyebrow">Harmonie jazz</p>
          <h1 class="home-title">Ton parcours</h1>
        </div>
        <a class="icon-btn" href="#/reglages" aria-label="Réglages">
          <SlidersIcon />
        </a>
      </header>

      <Segmented
        label="Où es-tu ?"
        value={p.where}
        onChange={(w: Where) => setWhere(w)}
        options={[
          { value: 'metro', label: 'Métro', sub: 'Sans piano' },
          { value: 'piano', label: 'Au piano', sub: 'Le micro écoute' }
        ]}
      />

      {next ? (
        <a class="next-card" href={hrefOf(next)}>
          <span class="label">
            Étape {stepNo(next.step)} · {next.step.title}
          </span>
          <b class="next-title">{next.kind === 'lesson' ? lessonTitle(next.id) : next.act.title}</b>
          <span class="muted small">
            {next.kind === 'lesson' ? 'Leçon, 3 à 5 minutes' : `${WHERE_LABEL[next.act.where]} · ${next.act.sub} · objectif : ${goalText(next.act.goal)}`}
          </span>
          <span class="btn primary block">Continuer</span>
        </a>
      ) : (
        <div class="next-card done">
          <b class="next-title">{p.where === 'metro' ? 'Plus rien à faire sans piano' : 'Parcours terminé'}</b>
          <span class="muted small">{p.where === 'metro' ? 'Passe en mode « Au piano » pour la suite.' : 'Tout est validé. Reprends les morceaux, ou refais une étape.'}</span>
        </div>
      )}
      {waiting ? (
        <p class="muted small">
          {waiting} exercice{waiting > 1 ? 's' : ''} au piano t’attend{waiting > 1 ? 'ent' : ''} dans les étapes ouvertes.
        </p>
      ) : null}

      <DayLine />

      <Review />

      <section>
        <h2 class="label">Parcours</h2>
        <ol class="steps">
          {STEPS.map((s) => {
            const st = stepState(p, s);
            const state = st.assumed ? 'assumed' : st.complete ? 'done' : s === nextStep ? 'now' : 'todo';
            return (
              <li key={s.id}>
                <a class={'step-row ' + state} href={`#/etape/${s.id}`}>
                  <Check state={state} />
                  <span class="row-main">
                    <span class="row-title">
                      {stepNo(s)}. {s.title}
                    </span>
                    <span class="row-sub">{st.assumed ? 'Acquise (point de départ)' : st.complete ? 'Terminée' : `${st.done}/${st.total}`}</span>
                  </span>
                  <ChevronIcon />
                </a>
              </li>
            );
          })}
        </ol>
      </section>

      <section>
        <h2 class="label">En libre</h2>
        <div class="list">
          <a class="row" href="#/morceaux">
            <span class="row-main">
              <span class="row-title">Morceaux</span>
              <span class="row-sub">28 standards : analyse, play-along, mémoire ; import</span>
            </span>
            <ChevronIcon />
          </a>
          <a class="row" href="#/clavier">
            <span class="row-main">
              <span class="row-title">Clavier</span>
              <span class="row-sub">Voir et entendre n’importe quel accord ; nommer ce que tu joues</span>
            </span>
            <ChevronIcon />
          </a>
          <InstallRow />
        </div>
      </section>
    </div>
  );
}

/** Ce que l'élève confond à l'oreille : à départager (accords, degrés, intervalles, enchaînements, rythmes, styles). */
function Review() {
  const NAME = { ear: 'Accords', full: 'Accord entier', iv: 'Intervalles', prog: 'Enchaînements', rythme: 'Rythmes', style: 'Styles' };
  const ear = (['ear', 'full', 'iv', 'prog'] as const).flatMap((m) => confusionsFor(m).slice(0, 1).map((pair) => ({ m, pair, name: (k: string) => oreilleItemName(m, k) })));
  const rhythm = confusions('rythme').slice(0, 1).map((pair) => ({ m: 'rythme' as const, pair, name: (k: string) => rhythmById(k)?.name ?? k }));
  const style = confusions('style').slice(0, 1).map((pair) => ({ m: 'style' as const, pair, name: (k: string) => GROOVES[k as StyleId]?.name ?? k }));
  const rows = [...ear, ...rhythm, ...style].sort((a, b) => b.pair.err - a.pair.err);
  if (!rows.length) return null;
  return (
    <section>
      <h2 class="label">À revoir</h2>
      <div class="list">
        {rows.slice(0, 2).map(({ m, pair, name }) => (
          <a key={m} class="row" href={`#/revoir/${m}`}>
            <span class="row-main">
              <span class="row-title">
                {name(pair.a)} ou {name(pair.b)} ?
              </span>
              <span class="row-sub">
                {NAME[m]} · confondus {pair.err} fois : à départager
              </span>
            </span>
            <ChevronIcon />
          </a>
        ))}
      </div>
    </section>
  );
}

/** Premier lancement : par où commencer. */
export function Placement() {
  return (
    <div class="screen home">
      <header class="home-head">
        <div>
          <p class="eyebrow">Harmonie jazz</p>
          <h1 class="home-title">Par où commencer ?</h1>
        </div>
      </header>
      <p class="intro">Un parcours en 10 étapes, des notes jusqu’à l’improvisation. Chaque étape : une leçon courte, des exercices dans le métro, puis au piano (le micro écoute).</p>
      <div class="list">
        {PLACEMENTS.map((pl) => (
          <button key={pl.step} class="row" onClick={() => setStart(pl.step)}>
            <span class="row-main">
              <span class="row-title">{pl.label}</span>
              <span class="row-sub">
                {pl.sub} · étape {pl.step + 1}
              </span>
            </span>
            <ChevronIcon />
          </button>
        ))}
      </div>
      <p class="muted small">Tu pourras ouvrir n’importe quelle étape, et changer ce choix dans les réglages.</p>
    </div>
  );
}

/** Visible tant que l'appli n'est pas installée (Android, Chrome). */
function InstallRow() {
  const [can, setCan] = useState(canInstall());
  useEffect(() => onInstallChange(() => setCan(canInstall())), []);
  if (!can) return null;
  return (
    <button class="row plain install" onClick={() => void install()}>
      <span class="row-main">
        <span class="row-title">Installer l’appli</span>
        <span class="row-sub">Icône sur l’écran d’accueil, plein écran, hors ligne.</span>
      </span>
      <ChevronIcon />
    </button>
  );
}

