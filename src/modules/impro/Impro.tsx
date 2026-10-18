import { BackIcon } from '../../ui/icons';
import { go } from '../../ui/router';

export function Impro() {
  return (
    <div class="screen">
      <div class="topbar">
        <button class="back" aria-label="Retour" onClick={() => go('/')}><BackIcon /></button>
        <h1>Improviser</h1>
      </div>
      <div class="stage">
        <h2>Au programme du lot 3</h2>
        <p class="hint">
          Gamme conseillée pour chaque accord, tirée de l'analyse (un G7 vers Cm appelle une gamme altérée), guide tones (3ces et 7es) qui
          s'enchaînent sur toute la grille, notes cibles sur le premier temps, approches chromatiques, plans ii–V dans les 12 tonalités, puis
          écoute de ton jeu au micro.
        </p>
        <p class="hint">
          En attendant : ouvre une grille, lance le play-along (basse, piano, batterie) et improvise sur ton piano. Commence par Autumn Leaves à
          100 BPM et vise la tierce de chaque accord sur le premier temps.
        </p>
        <button class="next" onClick={() => go('/grille/autumn-leaves')}>Ouvrir Autumn Leaves</button>
      </div>
    </div>
  );
}
