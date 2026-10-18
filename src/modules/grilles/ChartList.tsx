import { LIBRARY } from '../../library/charts';
import { keyLabel } from '../../core/chart/model';
import { BackIcon, ChevronIcon } from '../../ui/icons';
import { go } from '../../ui/router';

const STYLE: Record<string, string> = { swing: 'Swing', bossa: 'Bossa', ballade: 'Ballade', blues: 'Blues' };

export function ChartList() {
  return (
    <div class="screen">
      <div class="topbar">
        <button class="back" aria-label="Retour" onClick={() => go('/')}><BackIcon /></button>
        <h1>Grilles</h1>
      </div>
      <p class="muted small" style="margin:0">
        Chaque grille est analysée : centres tonaux, degrés, ii–V et résolutions. Lis-la, écoute-la, joue dessus. Les étoiles indiquent la difficulté harmonique.
      </p>
      <div class="list">
        {LIBRARY.map((c) => (
          <a key={c.id} class="row" href={`#/grille/${c.id}`}>
            <h3>{c.title}</h3>
            <span class="meta">
              <span class="level">{'★'.repeat(c.level)}</span>
              <span style="opacity:.35">{'★'.repeat(3 - c.level)}</span>
            </span>
            <p>
              {keyLabel(c.key)} · {STYLE[c.style]} · {c.bars.length} mesures
              {c.subtitle ? ` · ${c.subtitle.split(',')[0]}` : ''}
            </p>
          </a>
        ))}
      </div>
      <p class="muted small" style="margin:0;display:flex;align-items:center;gap:6px">
        Import de tes propres grilles : au lot 2 <ChevronIcon />
      </p>
    </div>
  );
}
