import { ChevronIcon } from './ui/icons';

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
        <p>Lire et analyser une grille, l'entendre, puis improviser dessus.</p>
      </div>
      <nav class="pillars">
        <a class="pillar" href="#/grilles">
          <span class="glyph">ii–V</span>
          <div>
            <h2>Lire et analyser</h2>
            <p>Grilles analysées, play-along, transposition, import de tes grilles.</p>
          </div>
          <span class="go"><ChevronIcon /></span>
        </a>
        <a class="pillar" href="#/express">
          <span class="glyph">60s</span>
          <div>
            <h2>Analyse express</h2>
            <p>Degrés, schémas, 9 ou ♭9, guide tones : le plus vite possible.</p>
          </div>
          <span class="go"><ChevronIcon /></span>
        </a>
        <a class="pillar" href="#/oreille">
          <span class="glyph">♪</span>
          <div>
            <h2>Entendre</h2>
            <p>Reconnaître accords et progressions, construire les accords au clavier.</p>
          </div>
          <span class="go"><ChevronIcon /></span>
        </a>
        <a class="pillar" href="#/impro">
          <span class="glyph">↝</span>
          <div>
            <h2>Improviser</h2>
            <p>La gamme de chaque accord et les guide tones, en direct sur le play-along.</p>
          </div>
          <span class="go"><ChevronIcon /></span>
        </a>
      </nav>
      <p class="credits">
        Piano : Salamander Grand Piano par Alexander Holm, licence{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>. Grilles d'accords uniquement.
      </p>
    </div>
  );
}
