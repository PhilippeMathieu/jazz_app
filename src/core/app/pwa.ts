// Installation et mises à jour de l'appli (iPhone et Android).
import { registerSW } from 'virtual:pwa-register';

const atHome = () => /^#?\/?$/.test(location.hash);

/**
 * Mise à jour : dès qu'une nouvelle version est téléchargée, elle s'applique sur l'accueil
 * (jamais au milieu d'un exercice). En revenant dans l'appli sur l'accueil, on vérifie s'il y en a une.
 */
export function setupUpdates() {
  if (!('serviceWorker' in navigator)) return;
  let ready = false;
  const update = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      if (atHome()) void update(true);
    },
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && atHome()) reg.update().catch(() => undefined);
      });
    }
  });
  addEventListener('hashchange', () => {
    if (ready && atHome()) void update(true);
  });
}

// ---------------------------------------------------------------- Installation (Android, ordinateur)

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();

/** Chrome (Android) propose l'installation : on garde l'événement pour un bouton « Installer ». */
export function setupInstall() {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    listeners.forEach((f) => f());
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
}
export const canInstall = () => !!deferred;
export const onInstallChange = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
export async function install() {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice.catch(() => undefined);
  deferred = null;
  listeners.forEach((f) => f());
}
