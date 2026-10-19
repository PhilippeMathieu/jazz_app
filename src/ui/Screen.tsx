import { ComponentChildren } from 'preact';
import { BackIcon } from './icons';
import { go } from './router';

/** Barre du haut : retour, titre, une zone d'actions à droite. */
export function TopBar({ title, back = '/', onBack, actions }: { title: string; back?: string; onBack?: () => void; actions?: ComponentChildren }) {
  return (
    <header class="topbar">
      <button class="icon-btn" aria-label="Retour" onClick={() => (onBack ? onBack() : go(back))}>
        <BackIcon />
      </button>
      <h1>{title}</h1>
      {actions ? <div class="topbar-actions">{actions}</div> : null}
    </header>
  );
}
