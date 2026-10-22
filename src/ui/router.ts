import { useEffect, useState } from 'preact/hooks';

export const go = (path: string) => {
  location.hash = '#' + path;
};

export function useRoute(): string[] {
  const read = () => (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const [r, setR] = useState(read);
  useEffect(() => {
    const f = () => {
      setR(read());
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}
