// Réharmoniser : une grille simple, une technique à appliquer (ou à reconnaître) ; avant / après à écouter.
import { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chord, chordSymbol } from '../../core/theory/chords';
import { keyLabel } from '../../core/chart/model';
import { audio, silence } from '../../core/audio/engine';
import { playSequence } from '../../core/audio/play';
import { load, save } from '../../core/storage';
import { report } from '../../core/game';
import { TopBar } from '../../ui/Screen';
import { LevelPicker, StartButton, levelShort } from '../../ui/Setup';
import { StatBars } from '../../ui/StatBars';
import { AnswerActions } from '../../ui/AnswerActions';
import { PlayIcon } from '../../ui/icons';
import { REHARM_LEVELS, RQuestion, RTYPE_LABEL, RType, makeReharm } from './reharm';

interface Saved {
  level: number;
  items: Record<string, { c: number; t: number }>;
}
const DEFAULT: Saved = { level: 0, items: {} };

export function Reharm({ header }: { header: ComponentChildren }) {
  const [s, setS] = useState<Saved>(() => load('reharm', DEFAULT));
  const [running, setRunning] = useState(false);
  useEffect(() => save('reharm', s), [s]);
  if (running) return <Play s={s} setS={setS} onStop={() => setRunning(false)} />;
  const types = REHARM_LEVELS[s.level].types;
  return (
    <div class="screen">
      <TopBar title="Enchaînements" />
      <p class="intro">Une grille simple et une technique : SubV, dominante secondaire, diminué de passage, ii–V ajouté. Tu choisis les accords, puis tu écoutes avant et après.</p>
      {header}
      <LevelPicker exo="reharm" levels={REHARM_LEVELS.map((l) => ({ name: l.name, desc: l.desc }))} value={s.level} onChange={(level) => setS({ ...s, level })} />
      <StartButton onClick={() => (audio(), setRunning(true))} />
      {types.some((t) => s.items[t]) ? (
        <section>
          <h2 class="label">Réussite, {levelShort(s.level).toLowerCase()}</h2>
          <StatBars rows={types.map((t) => ({ label: RTYPE_LABEL[t], c: s.items[t]?.c ?? 0, t: s.items[t]?.t ?? 0 }))} />
        </section>
      ) : null}
      <p class="muted small">La leçon « Réharmoniser » (Cours) explique les techniques. Pour les entendre sur un morceau : Morceaux, vue Degrés, où l’analyse les repère.</p>
    </div>
  );
}

function Grid({ chords, focus, label }: { chords: Chord[]; focus?: number[]; label: string }) {
  return (
    <div class="rh-grid">
      <span class="label">{label}</span>
      <div class="pchips">
        {chords.map((c, i) => (
          <span key={i} class={'pchip' + (focus?.includes(i) ? ' on' : '')}>
            <b>{chordSymbol(c)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function Play({ s, setS, onStop }: { s: Saved; setS: (f: (x: Saved) => Saved) => void; onStop: () => void }) {
  const [q, setQ] = useState<RQuestion>(() => makeReharm(s.level, s.items));
  const [answer, setAnswer] = useState<string | null>(null);
  const [session, setSession] = useState({ c: 0, t: 0 });
  const qStart = useRef(performance.now());
  const hear = (chords: Chord[]) => {
    audio();
    silence();
    playSequence(chords, { gap: 1.25 });
  };
  useEffect(() => {
    if (q.type === 'spot') hear(q.after);
    return () => silence();
  }, [q]);

  const record = (type: RType, ok: boolean) =>
    setS((x) => {
      const it = x.items[type] ?? { c: 0, t: 0 };
      return { ...x, items: { ...x.items, [type]: { c: it.c + (ok ? 1 : 0), t: it.t + 1 } } };
    });
  const choose = (c: string) => {
    if (answer) return;
    const ok = c === q.answer;
    setAnswer(c);
    record(q.type, ok);
    setSession((x) => ({ c: x.c + (ok ? 1 : 0), t: x.t + 1 }));
    hear(q.after);
  };
  const next = (guessed = false) => {
    report({ type: 'answer', exo: 'reharm', level: s.level, ok: answer === q.answer && !guessed, ms: performance.now() - qStart.current });
    if (guessed)
      setS((x) => {
        const it = x.items[q.type];
        return it ? { ...x, items: { ...x.items, [q.type]: { ...it, c: Math.max(0, it.c - 1) } } } : x;
      });
    qStart.current = performance.now();
    setAnswer(null);
    setQ(makeReharm(s.level, s.items));
  };
  const ok = answer === q.answer;
  const spot = q.type === 'spot';
  // Les accords nouveaux, surlignés une fois la réponse donnée.
  const before = new Set(q.before.map(chordSymbol));
  const changed = answer ? q.after.map((c, i) => (before.has(chordSymbol(c)) ? -1 : i)).filter((i) => i >= 0) : [];

  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button
          class="btn ghost sm"
          onClick={() => {
            silence();
            onStop();
          }}
        >
          Arrêter
        </button>
        <span class="play-meta">
          Réharmoniser · {levelShort(s.level)} · {session.c}/{session.t}
        </span>
      </header>
      <section class="ear-stage">
        <p class="full-ref">
          En <b>{keyLabel(q.key)}</b>
        </p>
        <Grid chords={q.before} focus={spot ? [] : q.focus} label="Avant" />
        {spot || answer ? <Grid chords={q.after} focus={changed} label="Après" /> : null}
        <div class="row-actions">
          <button class="btn sm" onClick={() => hear(q.before)}>
            <PlayIcon /> Avant
          </button>
          {spot || answer ? (
            <button class="btn sm" onClick={() => hear(q.after)}>
              <PlayIcon /> Après
            </button>
          ) : null}
        </div>
        <h2 class="prompt">{q.prompt}</h2>
        {answer ? (
          <div class="fb">
            <p class={'verdict ' + (ok ? 'ok' : 'bad')}>{ok ? `Juste : ${q.answer}.` : `Non : ${q.answer}.`}</p>
            <p class="muted">{q.explain}</p>
          </div>
        ) : null}
      </section>
      <div class="thumb-zone">
        {answer ? (
          <AnswerActions ok={ok} onNext={() => next()} onGuess={() => next(true)} />
        ) : (
          <div class={'choices' + (q.choices.some((c) => c.length > 8) ? ' long' : '')}>
            {q.choices.map((c) => (
              <button key={c} class="choice" onClick={() => choose(c)}>
                <span>{c}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
