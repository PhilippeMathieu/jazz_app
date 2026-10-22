// Oreille › Ligne de basse : après l'accord de la tonique, 4 fondamentales ; dire le degré de chacune.
import { useEffect, useRef, useState } from 'preact/hooks';
import { keyLabel } from '../../core/chart/model';
import { pcOf } from '../../core/theory/notes';
import { audio, bass, drum, now, piano, playChord, silence } from '../../core/audio/engine';
import { confusions, recordAnswer } from '../../core/confusions';
import { report } from '../../core/events';
import { AnswerActions } from '../../ui/AnswerActions';
import { PlayIcon } from '../../ui/icons';
import { BASS_LEVELS, BASS_NOTES, BassQuestion, DEGREES, chordLine, degreeName, judgeBass, makeBassQuestion } from './bassline';
import { Tally } from './questions';

const REF = 1.5;
const STEP = 1.05;

export function BassPlay({
  level,
  items,
  onRecord,
  onGuess,
  onStop
}: {
  level: number;
  items: Tally;
  onRecord: (results: [string, boolean][]) => void;
  onGuess: (items: string[]) => void;
  onStop: () => void;
}) {
  const lv = BASS_LEVELS[level] ?? BASS_LEVELS[0];
  const make = () => makeBassQuestion(level, items, confusions('basse'));
  const [q, setQ] = useState<BassQuestion>(make);
  const [given, setGiven] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [lit, setLit] = useState(-1);
  const [session, setSession] = useState({ c: 0, t: 0 });
  const timers = useRef<number[]>([]);
  const qStart = useRef(performance.now());

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    silence();
    setLit(-1);
  };
  const at = (sec: number, f: () => void) => timers.current.push(window.setTimeout(f, Math.max(0, sec * 1000)));

  /** Accord de la tonique, puis la ligne (seule, ou avec piano et batterie au niveau walking). onPiano : la ligne au piano, deux octaves plus haut. */
  const play = (qq: BassQuestion = q, onPiano = false) => {
    audio();
    stop();
    const t0 = now() + 0.08;
    playChord(qq.ref.slice(1), t0, REF - 0.2, 0.45);
    if (onPiano) piano(qq.ref[0] + 12, t0, REF - 0.2, 0.5);
    else bass(qq.ref[0], t0, REF - 0.2, 0.85);
    const start = t0 + REF + 0.3;
    const wait = start - now();
    if (qq.events && !onPiano) {
      const spb = 60 / qq.tempo;
      for (const e of qq.events) {
        const t = start + e.beat * spb;
        if (e.kind === 'bass') bass(e.midi, t, e.dur * spb, e.vel);
        else if (e.kind === 'chord') playChord(e.notes, t, e.dur * spb, e.vel);
        else if (e.kind === 'drum') drum(e.sound, t, e.vel);
      }
      qq.notes.forEach((_, i) => at(wait + i * 4 * spb, () => setLit(i)));
      at(wait + qq.notes.length * 4 * spb, () => setLit(-1));
    } else {
      qq.notes.forEach((m, i) => {
        if (onPiano) piano(m + 24, start + i * STEP, STEP - 0.1, 0.6);
        else bass(m, start + i * STEP, STEP - 0.1, 0.85);
        at(wait + i * STEP, () => setLit(i));
      });
      at(wait + qq.notes.length * STEP, () => setLit(-1));
    }
  };
  /** Une note après la tonique, pour entendre son degré. */
  const hear = (i: number) => {
    audio();
    stop();
    const t0 = now() + 0.05;
    const tonic = 36 + pcOf(q.key.tonic);
    bass(tonic, t0, 0.8, 0.8);
    piano(tonic + 24, t0, 0.8, 0.45);
    bass(q.notes[i], t0 + 0.9, 1.2, 0.85);
    piano(q.notes[i] + 24, t0 + 0.9, 1.2, 0.5);
    setLit(i);
    at(2.1, () => setLit(-1));
  };
  useEffect(() => {
    play(q);
    return () => stop();
  }, []);

  const submit = (all: string[]) => {
    const j = judgeBass(q, all);
    setDone(true);
    onRecord(q.degrees.map((d, i) => ['bass:' + d.id, j.ok[i]] as [string, boolean]));
    q.degrees.forEach((d, i) => recordAnswer('basse', d.id, all[i], lv.ids));
    const n = j.ok.filter(Boolean).length;
    setSession((s) => ({ c: s.c + n, t: s.t + BASS_NOTES }));
  };
  // Mises à jour fonctionnelles : deux touches rapprochées comptent toutes les deux.
  const pick = (id: string) => {
    if (!done) setGiven((g) => (g.length < BASS_NOTES ? [...g, id] : g));
  };
  useEffect(() => {
    if (!done && given.length === BASS_NOTES) submit(given);
  }, [given]);
  const next = (guessed = false) => {
    if (done) {
      const j = judgeBass(q, given);
      const ms = (performance.now() - qStart.current) / BASS_NOTES;
      j.ok.forEach((ok) => report({ type: 'answer', exo: 'oreille-bass', level, ok: ok && !guessed, ms }));
    }
    qStart.current = performance.now();
    const nq = make();
    setQ(nq);
    setGiven([]);
    setDone(false);
    play(nq);
  };

  const j = done ? judgeBass(q, given) : null;
  const allOk = !!j && j.ok.every(Boolean);
  const flats = lv.ids.some((x) => x.startsWith('♭'));
  const chords = chordLine(q);

  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={onStop}>
          Arrêter
        </button>
        <span class="play-meta">
          Ligne de basse · {session.c}/{session.t}
        </span>
      </header>
      <section class="ear-stage">
        <p class="full-ref">
          Tonalité : <b>{keyLabel(q.key)}</b>
          <span class="muted small"> · l’accord de {degreeName(q.key, DEGREES[0])} sonne d’abord</span>
        </p>
        <div class="playrow">
          <button class="play big-play" aria-label="Réécouter" onClick={() => play()}>
            <PlayIcon />
          </button>
          <button class="btn" onClick={() => play(q, true)}>
            Au piano
          </button>
        </div>
        <h2 class="prompt">{lv.walking ? 'Quelle fondamentale, sur le 1 de chaque mesure ?' : 'Quels degrés joue la basse ?'}</h2>
        <div class="bslots">
          {Array.from({ length: BASS_NOTES }, (_, i) => {
            const d = q.degrees[i];
            const cls = 'bslot' + (j ? (j.ok[i] ? ' ok' : ' bad') : i === given.length ? ' cur' : '') + (lit === i ? ' lit' : '');
            return j ? (
              <button key={i} class={cls} onClick={() => hear(i)} aria-label={`Réécouter la note ${i + 1}`}>
                <span>{d.id}</span>
                <small>{degreeName(q.key, d)}</small>
                {!j.ok[i] ? <s>{given[i]}</s> : null}
              </button>
            ) : (
              <span key={i} class={cls}>
                <span>{given[i] ?? '·'}</span>
              </span>
            );
          })}
        </div>
        {j ? (
          <div class="fb">
            <p class={'verdict ' + (allOk ? 'ok' : 'bad')}>{allOk ? 'Juste, les 4.' : `${j.ok.filter(Boolean).length}/4 justes.`}</p>
            {j.notes.map((t) => (
              <p key={t} class="muted">
                {t}
              </p>
            ))}
            <p class="muted">La basse : {j.moves.join(' · ')}. Touche une note pour l’entendre après la tonique.</p>
            {chords.length ? <p class="mono">{chords.join(' | ')}</p> : null}
          </div>
        ) : null}
      </section>
      <div class="thumb-zone">
        {j ? (
          <AnswerActions
            ok={allOk}
            onNext={() => next()}
            onGuess={() => {
              onGuess(q.degrees.map((d) => 'bass:' + d.id));
              setSession((s) => ({ ...s, c: Math.max(0, s.c - BASS_NOTES) }));
              next(true);
            }}
          />
        ) : (
          <>
            <div class={'degpad' + (flats ? ' flats' : '')}>
              {DEGREES.filter((d) => !d.id.startsWith('♭') || flats).map((d) => {
                const flat = d.id.startsWith('♭');
                const col = flat ? 2 * d.letter : 2 * d.letter + 1;
                return (
                  <button
                    key={d.id}
                    class={'deg' + (flat ? ' flat' : '')}
                    style={`grid-column:${col} / span 2`}
                    disabled={!lv.ids.includes(d.id)}
                    onClick={() => pick(d.id)}
                  >
                    <b>{d.id}</b>
                    <small>{degreeName(q.key, d)}</small>
                  </button>
                );
              })}
            </div>
            <div class="row-actions">
              <button class="btn" disabled={!given.length} onClick={() => setGiven((g) => g.slice(0, -1))}>
                Effacer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
