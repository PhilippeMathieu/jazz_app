import { useEffect, useState } from 'preact/hooks';
import { canInstall, install, onInstallChange } from './core/app/pwa';
import { ChevronIcon } from './ui/icons';
import { load } from './core/storage';
import { advice } from './core/progress';
import { LIBRARY, chartById } from './library/charts';
import { LESSONS, lessonById } from './modules/cours/lessons';
import { coursProgress, nextLesson } from './modules/cours/Cours';
import { SECTIONS, SectionId, TRAINING } from './ui/sections';
import { Challenges, GameStrip, useGame } from './ui/GameStrip';

/** Nom de l'écran où reprendre (les mêmes noms que sur l'accueil). */
function resumeLabel(path: string): string | null {
  const [page, id] = path.split('/').filter(Boolean);
  if (page === 'grille') return chartById(id)?.title ?? null;
  if (page === 'cours') return id === 'astuces' ? 'Cours · astuces d’enchaînement' : id ? `Cours · ${lessonById(id)?.title ?? ''}` : SECTIONS.cours.title;
  return page in SECTIONS ? SECTIONS[page as SectionId].title : null;
}

function Row({ href, title, sub }: { href: string; title: string; sub: string }) {
  return (
    <a class="row" href={href}>
      <span class="row-main">
        <span class="row-title">{title}</span>
        <span class="row-sub">{sub}</span>
      </span>
      <ChevronIcon />
    </a>
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

export function Home() {
  const last = load('last', { path: '' }).path;
  const label = last ? resumeLabel(last) : null;
  const weak = advice();
  const cours = coursProgress();
  const nextL = nextLesson(cours);
  const first = LESSONS[0];
  const g = useGame();
  return (
    <div class="screen home">
      <h1 class="wordmark">
        Harmonie <em>jazz</em>
      </h1>

      <InstallRow />

      <GameStrip g={g} />

      {label ? (
        <a class="resume" href={'#' + last}>
          <span class="row-main">
            <span class="label">Continuer</span>
            <span class="row-title">{label}</span>
          </span>
          <ChevronIcon />
        </a>
      ) : (
        <a class="resume" href={`#/cours/${first.id}`}>
          <span class="row-main">
            <span class="label">Pour commencer</span>
            <span class="row-title">Leçon 1 · {first.title}</span>
            <span class="row-sub">{first.minutes} minutes, puis un exercice pour pratiquer.</span>
          </span>
          <ChevronIcon />
        </a>
      )}

      <Challenges list={g.challenges.list} />

      {weak.length ? (
        <section>
          <h2 class="label">À travailler</h2>
          <div class="list">
            {weak.map((w) => (
              <Row key={w.text} href={w.href} title={w.text} sub={w.detail} />
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 class="label">Apprendre</h2>
        <div class="list">
          <Row
            href={nextL && cours.read.length ? `#/cours/${nextL.id}` : '#/cours'}
            title={SECTIONS.cours.title}
            sub={
              nextL
                ? `${cours.read.length}/${LESSONS.length} leçons lues${cours.read.length ? ` · suivante : ${nextL.title}` : ''}`
                : `Les ${LESSONS.length} leçons sont lues : à revoir quand tu veux.`
            }
          />
          <Row href="#/clavier" title={SECTIONS.clavier.title} sub={SECTIONS.clavier.sub} />
        </div>
      </section>

      <section>
        <h2 class="label">S’entraîner</h2>
        <div class="tiles">
          {TRAINING.map((id) => {
            const s = SECTIONS[id];
            return (
              <a key={id} class="tile" href={`#/${id}`}>
                <span class="tile-title">{s.title}</span>
                <span class="tile-sub">{s.sub}</span>
                <span class="tile-where">{s.where}</span>
              </a>
            );
          })}
        </div>
      </section>

      <section>
        <h2 class="label">Jouer</h2>
        <div class="list">
          <Row href="#/grilles" title={SECTIONS.grilles.title} sub={`${LIBRARY.length} standards analysés et accompagnés, dans 7 styles`} />
        </div>
      </section>

      <a class="tool-link" href="#/micro">
        Régler le micro
      </a>

      <p class="credits">
        Piano : Salamander Grand Piano, Alexander Holm,{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">
          CC BY 3.0
        </a>
        . Contrebasse : soundfont Musyng Kite,{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">
          CC BY-SA 3.0
        </a>
        . Batterie : Versilian Community Sample Library, CC0. Notation : police Bravura (Steinberg), SIL OFL 1.1. Grilles d'accords uniquement.
      </p>
    </div>
  );
}
