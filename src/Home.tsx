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
            <p>5 grilles analysées, play-along, transposition dans les 12 tonalités.</p>
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
        <a class="pillar soon" href="#/impro">
          <span class="glyph">↝</span>
          <div>
            <h2>Improviser</h2>
            <p>Gammes, guide tones, notes cibles.</p>
          </div>
          <span class="tag">Lot 3</span>
        </a>
      </nav>
      <p class="credits">
        Piano : Salamander Grand Piano par Alexander Holm, licence{' '}
        <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noopener">CC BY 3.0</a>. Grilles d'accords uniquement.
      </p>
    </div>
  );
}
