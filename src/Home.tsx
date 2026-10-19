import { ChevronIcon } from './ui/icons';

interface Tile {
  href: string;
  glyph: string;
  title: string;
  text: string;
  tag?: string;
}

const METRO: Tile[] = [
  { href: '#/express', glyph: '60s', title: 'Analyse express', text: 'Degrés, schémas, 9 ou ♭9, guide tones : le plus vite possible.', tag: 'Sans son' },
  { href: '#/grilles', glyph: 'ii–V', title: 'Lire et analyser', text: 'Masque l’analyse, retrouve les degrés, vérifie. Import depuis Ultimate Guitar.' },
  { href: '#/oreille', glyph: '♪', title: 'Entendre', text: 'Reconnaître accords et progressions, construire les accords au doigt.', tag: 'Écouteurs' }
];
const PIANO: Tile[] = [
  { href: '#/flash', glyph: 'A/B', title: 'Flash voicings', text: 'Un accord s’affiche, tu le joues, l’appli révèle le voicing. Mains libres.' },
  { href: '#/impro', glyph: '↝', title: 'Improviser', text: 'Gamme et guide tones de chaque accord, sur le play-along, en mode pupitre.' },
  { href: '#/grilles', glyph: '\u25B6\uFE0E', title: 'Play-along', text: 'Basse, piano, batterie sur les grilles. Mode pupitre pour lire de loin.' }
];

function Tiles({ list }: { list: Tile[] }) {
  return (
    <nav class="pillars">
      {list.map((t) => (
        <a key={t.title} class="pillar" href={t.href}>
          <span class="glyph">{t.glyph}</span>
          <div>
            <h2>{t.title}</h2>
            <p>{t.text}</p>
          </div>
          {t.tag ? <span class="tag">{t.tag}</span> : <span class="go"><ChevronIcon /></span>}
        </a>
      ))}
    </nav>
  );
}

export function Home() {
  return (
    <div class="screen">
      <div class="hero">
        <p class="eyebrow">Piano jazz · harmonie</p>
        <h1>
          Harmonie
          <br />
          <em>jazz</em>
        </h1>
      </div>

      <section class="ctx">
        <div class="ctx-head">
          <h2>Dans le métro</h2>
          <span>Sans piano, d’une main, hors ligne</span>
        </div>
        <Tiles list={METRO} />
      </section>

      <section class="ctx">
        <div class="ctx-head">
          <h2>Au piano</h2>
          <span>Téléphone sur le pupitre, écran toujours allumé</span>
        </div>
        <Tiles list={PIANO} />
      </section>

      <p class="credits">
        Piano : Salamander Grand Piano par Alexander Holm, licence{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>. Grilles d'accords uniquement.
      </p>
    </div>
  );
}
