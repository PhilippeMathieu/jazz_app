// Astuces d'enchaînement : règle, exemple écrit (accords + ligne, degrés), écoute, autre tonalité.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { chordSymbol } from '../../core/theory/chords';
import { keyLabel } from '../../core/chart/model';
import { audio, now, piano, playChord } from '../../core/audio/engine';
import { sequenceVoicings } from '../../core/audio/play';
import { TopBar } from '../../ui/Screen';
import { PlayIcon } from '../../ui/icons';
import { TIPS, Tip, anotherKey, realize } from './tips';

export function TipsView() {
  return (
    <div class="screen lesson">
      <TopBar title="Astuces d’enchaînement" back="/cours" />
      <p class="intro">
        {TIPS.length} réflexes de conduite des voix pour passer d’un accord à l’autre. Écoute l’exemple, joue-le, puis change de tonalité : l’astuce marche partout.
      </p>
      {TIPS.map((t, i) => (
        <TipCard key={t.id} tip={t} n={i + 1} />
      ))}
    </div>
  );
}

function TipCard({ tip, n }: { tip: Tip; n: number }) {
  const [pc, setPc] = useState(0);
  const r = useMemo(() => realize(tip, pc), [tip, pc]);
  const [active, setActive] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clear, []);

  const play = () => {
    clear();
    audio();
    const gap = tip.gap ?? 1.3;
    const t0 = now() + 0.05;
    // Main gauche en shells (fondamentale, 3ce, 7e), ligne au-dessus.
    sequenceVoicings(r.chords, 'shell').forEach((v, i) => {
      const t = t0 + i * gap;
      playChord(v, t, gap * 0.95, 0.42);
      const notes = r.line.filter((x) => x.chord === i);
      notes.forEach((x, j) => {
        if (tip.together) piano(x.midi, t, gap * 0.9, 0.7);
        else piano(x.midi, t + (j * gap) / notes.length, (gap / notes.length) * 0.95, 0.75);
      });
      timers.current.push(window.setTimeout(() => setActive(i), 50 + i * gap * 1000));
    });
    timers.current.push(window.setTimeout(() => setActive(null), 50 + r.chords.length * gap * 1000));
  };

  return (
    <article class="tip">
      <div class="tip-head">
        <span class="tip-n">{n}</span>
        <h2 class="tip-title">{tip.title}</h2>
      </div>
      <p class="ls-p">{tip.rule}</p>
      <div class="tip-ex">
        <div class="ls-demo-head">
          <span class="muted small">En {keyLabel(r.key)}</span>
          <span class="row-actions">
            <button class="btn sm ghost" onClick={() => setPc(anotherKey(tip, pc))}>
              Autre tonalité
            </button>
            <button class="btn sm" onClick={play}>
              <PlayIcon /> Écouter
            </button>
          </span>
        </div>
        <div class="tip-chords">
          {r.chords.map((c, i) => (
            <div key={i} class={'tip-chord' + (active === i ? ' on' : '')}>
              <span class="sym">{chordSymbol(c)}</span>
              <span class="rn">{r.romans[i]}</span>
              <span class="tip-line">
                {r.line
                  .filter((x) => x.chord === i)
                  .map((x, j) => (
                    <b key={j}>
                      {x.name}
                      <small>{x.degree}</small>
                    </b>
                  ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
