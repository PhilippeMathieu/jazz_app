import { ChevronIcon } from './ui/icons';
import { load } from './core/storage';
import { advice } from './core/progress';
import { chartById } from './library/charts';

interface Tile {
  href: string;
  title: string;
  text: string;
  tag?: string;
}
const METRO: Tile[] = [
  { href: '#/lecture', title: 'Lecture de notes', text: 'Clé de sol, clé de fa : touche, nomme ou joue la note au piano.' },
  { href: '#/tonalite', title: 'Accords de la tonalité', text: 'En D majeur, F♯ : maj7, m7, 7 ou ø7 ? Chronométré, 12 tonalités.' },
  { href: '#/express', title: 'Analyse express', text: 'Degrés, enchaînements, 9 ou ♭9, guide tones, chronométrés.' },
  { href: '#/oreille', title: 'Oreille', text: 'Reconnaître accords et progressions, construire les accords.', tag: 'Écouteurs' }
];
const PIANO: Tile[] = [
  { href: '#/grilles', title: 'Grilles', text: 'Analyse, quiz, gammes et guide tones sur le play-along. Mode pupitre.' },
  { href: '#/flash', title: 'Flash voicings', text: 'Un accord s’affiche, tu le joues, l’appli écoute et valide.' }
];

function resumeLabel(path: string): string | null {
  const [page, id] = path.split('/').filter(Boolean);
  if (page === 'grille') return chartById(id)?.title ?? null;
  return { lecture: 'Lecture de notes', tonalite: 'Accords de la tonalité', express: 'Analyse express', oreille: 'Oreille', flash: 'Flash voicings' }[page] ?? null;
}

function Rows({ list }: { list: Tile[] }) {
  return (
    <div class="list">
      {list.map((t) => (
        <a key={t.title} class="row" href={t.href}>
          <span class="row-main">
            <span class="row-title">{t.title}</span>
            <span class="row-sub">{t.text}</span>
          </span>
          {t.tag ? <span class="tag">{t.tag}</span> : <ChevronIcon />}
        </a>
      ))}
    </div>
  );
}

export function Home() {
  const last = load('last', { path: '' }).path;
  const label = last ? resumeLabel(last) : null;
  const todo = advice();
  return (
    <div class="screen home">
      <h1 class="wordmark">
        Harmonie <em>jazz</em>
      </h1>

      {label ? (
        <a class="resume" href={'#' + last}>
          <span class="row-main">
            <span class="label">Reprendre</span>
            <span class="row-title">{label}</span>
          </span>
          <ChevronIcon />
        </a>
      ) : null}

      {todo.length ? (
        <section>
          <h2 class="label">À travailler</h2>
          <Rows list={todo.map((t) => ({ href: t.href, title: t.text, text: t.detail }))} />
        </section>
      ) : null}

      <section>
        <h2 class="label">Dans le métro</h2>
        <Rows list={METRO} />
      </section>
      <section>
        <h2 class="label">Au piano</h2>
        <Rows list={PIANO} />
      </section>

      <a class="row plain" href="#/micro">
        <span class="row-main">
          <span class="row-title">Micro</span>
          <span class="row-sub">Tester et régler l’écoute du piano</span>
        </span>
        <ChevronIcon />
      </a>

      <p class="credits">
        Piano : Salamander Grand Piano, Alexander Holm,{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">
          CC BY 3.0
        </a>
        . Notation : police Bravura (Steinberg), SIL OFL 1.1. Grilles d'accords uniquement.
      </p>
    </div>
  );
}
