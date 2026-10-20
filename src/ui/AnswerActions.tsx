// Après chaque réponse : on lit l'explication, puis on continue. Juste mais au hasard ? « J'ai deviné » :
// la question compte comme à revoir et reviendra plus souvent.
export function AnswerActions({ ok, onNext, onGuess }: { ok: boolean; onNext: () => void; onGuess: () => void }) {
  return (
    <div class="row-actions answer-actions">
      {ok ? (
        <button class="btn" onClick={onGuess}>
          J’ai deviné
        </button>
      ) : null}
      <button class="btn primary" onClick={onNext}>
        Continuer
      </button>
    </div>
  );
}
