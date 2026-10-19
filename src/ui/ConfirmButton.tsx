import { useEffect, useRef, useState } from 'preact/hooks';

/** Bouton à double appui (pas de boîte de dialogue) : « Supprimer » puis « Confirmer ». */
export function ConfirmButton({ label, confirm, onConfirm }: { label: string; confirm: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  return (
    <button
      class={'linkbtn' + (armed ? ' armed' : '')}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
          return;
        }
        setArmed(true);
        timer.current = window.setTimeout(() => setArmed(false), 3000);
      }}
    >
      {armed ? confirm : label}
    </button>
  );
}
