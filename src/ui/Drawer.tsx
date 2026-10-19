// Panneau qui monte du bas de l'écran (au-dessus du lecteur s'il y en a un).
import { ComponentChildren } from 'preact';
import { CloseIcon } from './icons';

export function Drawer({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ComponentChildren; label: string }) {
  if (!open) return null;
  return (
    <>
      <div class="drawer-backdrop" onClick={onClose} />
      <section class="drawer" role="dialog" aria-label={label}>
        <button class="icon-btn drawer-close" aria-label="Fermer" onClick={onClose}>
          <CloseIcon />
        </button>
        {children}
      </section>
    </>
  );
}
