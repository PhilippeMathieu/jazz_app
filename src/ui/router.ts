import { useEffect, useState } from 'preact/hooks';
import { save } from '../core/storage';

export const go = (path: string) => {
  location.hash = '#' + path;
};

/** Écrans d'exercice mémorisés pour « Reprendre » sur l'accueil. */
const RESUMABLE = ['grille', 'cours', 'lecture', 'tonalite', 'express', 'oreille', 'flash'];

export function useRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => {
    const f = () => {
      const next = read();
      setR(next);
      window.scrollTo(0, 0);
      if (RESUMABLE.includes(next[0])) save('last', { path: '/' + next.join('/') });
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}
