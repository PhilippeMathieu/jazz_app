// Oreille › Accord entier : une référence (tonique ou do), puis un accord ; trouver fondamentale et nature.
import { useEffect, useRef, useState } from 'preact/hooks';
import { QUALITIES, chordOnPc, chordSymbol } from '../../core/theory/chords';
import { mod, pcOf } from '../../core/theory/notes';
import { keyLabel } from '../../core/chart/model';
import { audio, now, piano, playChord, silence } from '../../core/audio/engine';
import { confusions, recordAnswer } from '../../core/confusions';
import { report } from '../../core/events';
import { Keyboard } from '../../ui/Keyboard';
import { AnswerActions } from '../../ui/AnswerActions';
import { PlayIcon } from '../../ui/icons';
import { notesMarks } from '../../ui/keyboardMarks';
import { FULL_TONAL, FullAnswer, FullQuestion, itemOfAnswer, judgeFull, makeFullDuel, makeFullQuestion, pcNameIn } from './full';
import { Tally, earVoicing } from './questions';

const qName = (k: string) => (k === 'maj' ? 'majeur' : k === 'min' ? 'mineur' : QUALITIES[k].sym);
const REF_DUR = 1.1;

export function FullPlay({
  level,
  items,
  duelMode,
  onRecord,
  onStop
}: {
  level: number;
  items: Tally;
  duelMode: boolean;
  onRecord: (item: string, result: 'ok' | 'ko' | 'guess') => void;
  onStop: () => void;
}) {
  const last = useRef<string | undefined>(undefined);
  const make = (): FullQuestion => {
    const pairs = confusions('degre');
    if (duelMode) {
      const d = makeFullDuel(pairs, last.current);
      if (d) return d;
    }
    return makeFullQuestion(level, items, pairs, last.current);
  };
  const [q, setQ] = useState<FullQuestion>(make);
  const [root, setRoot] = useState<number | null>(null);
  const [quality, setQuality] = useState<string | null>(null);
  const [answer, setAnswer] = useState<FullAnswer | null>(null);
  const [session, setSession] = useState({ c: 0, t: 0 });
  const qStart = useRef(performance.now());
  const timers = useRef<number[]>([]);

  const stop = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    silence();
  };
  /** Référence, puis l'accord. */
  const play = (qq: FullQuestion = q, notes: number[] = qq.notes, withRef = true) => {
    audio();
    stop();
    const t0 = now() + 0.06;
    if (withRef) {
      if (qq.key) playChord(qq.ref, t0, REF_DUR - 0.1, 0.5);
      else piano(qq.ref[0], t0, REF_DUR - 0.1, 0.6);
    }
    playChord(notes, t0 + (withRef ? REF_DUR + 0.25 : 0), 2, 0.6);
  };
  const arpeggio = () => {
    audio();
    stop();
    const t0 = now() + 0.05;
    q.notes.forEach((m, i) => piano(m, t0 + i * 0.2, 1.6, 0.55));
  };
  useEffect(() => {
    play(q);
    return () => stop();
  }, []);

  const submit = (a: FullAnswer) => {
    if (answer) return;
    setAnswer(a);
    const j = judgeFull(q, a);
    const label = q.item ? q.item.id : q.chord.quality;
    onRecord('full:' + label, j.ok ? 'ok' : 'ko');
    setSession((s) => ({ c: s.c + (j.ok ? 1 : 0), t: s.t + 1 }));
    // Confusions de degrés (dans une tonalité) : le degré répondu contre le vrai.
    if (q.item) {
      const given = itemOfAnswer(q.key, a);
      const options = q.duel ? q.duel.map((d) => itemOfAnswer(q.key, d)?.id ?? '') : (FULL_TONAL[Math.min(level, FULL_TONAL.length - 1)] ?? []).map((x) => x.id);
      if (given) recordAnswer('degre', q.item.id, given.id, options);
    }
    play(q, q.notes, false);
  };
  const pickRoot = (r: number) => {
    setRoot(r);
    if (quality !== null) submit({ root: r, quality });
  };
  const pickQuality = (k: string) => {
    setQuality(k);
    if (root !== null) submit({ root, quality: k });
  };
  const next = (guessed = false) => {
    if (answer) report({ type: 'answer', exo: 'oreille-full', level, ok: !!judgeFull(q, answer).ok && !guessed, ms: performance.now() - qStart.current, duel: !!q.duel });
    qStart.current = performance.now();
    const nq = make();
    last.current = nq.item?.id;
    setQ(nq);
    setRoot(null);
    setQuality(null);
    setAnswer(null);
    play(nq);
  };

  const j = answer ? judgeFull(q, answer) : null;
  const answerChord = answer && !j?.ok ? { ...chordOnPc(answer.root, answer.quality) } : null;
  const km = notesMarks(q.chord, q.notes);
  const label = (a: FullAnswer) => `${pcNameIn(a.root, q.key)}${a.quality === 'maj' ? '' : a.quality === 'min' ? 'm' : QUALITIES[a.quality].sym}`;

  return (
    <div class="screen play-screen">
      <header class="topbar">
        <button class="btn ghost sm" onClick={onStop}>
          Arrêter
        </button>
        <span class="play-meta">
          Accord entier · {q.duel ? 'mes confusions · ' : ''}{session.c}/{session.t}
        </span>
      </header>
      <section class="ear-stage">
        <p class="full-ref">
          {q.key ? (
            <>
              Tonalité : <b>{keyLabel(q.key)}</b>
              <span class="muted small"> · l’accord de {pcNameIn(pcOf(q.key.tonic), q.key)} sonne d’abord</span>
            </>
          ) : (
            <>
              Référence : <b>la note do (C)</b>
              <span class="muted small"> · elle sonne d’abord</span>
            </>
          )}
        </p>
        <div class="playrow">
          <button class="play big-play" aria-label="Réécouter avec la référence" onClick={() => play()}>
            <PlayIcon />
          </button>
          <button class="btn" onClick={() => play(q, q.notes, false)}>
            Accord seul
          </button>
          <button class="btn" onClick={arpeggio}>
            Arpège
          </button>
        </div>
        <h2 class="prompt">Quel accord ? Fondamentale et nature.</h2>
        {j && answer ? (
          <div class="fb">
            <p class={'verdict ' + (j.ok ? 'ok' : 'bad')}>{j.ok ? `Juste : ${chordSymbol(q.chord)}.` : `Non, c’était ${chordSymbol(q.chord)}.`}</p>
            <p class="muted">{j.text}</p>
            {answerChord ? (
              <div class="compare">
                <span class="label">Compare, après la même référence</span>
                <div class="row-actions">
                  <button class="btn sm" onClick={() => play(q)}>
                    <PlayIcon /> {chordSymbol(q.chord)}
                  </button>
                  <button class="btn sm" onClick={() => play(q, earVoicing(answerChord, 1, () => 0))}>
                    <PlayIcon /> {label(answer)}
                  </button>
                </div>
              </div>
            ) : null}
            <Keyboard lo={36} hi={84} marks={km.marks} labels={km.labels} center={q.notes} />
          </div>
        ) : null}
      </section>
      <div class="thumb-zone">
        {answer ? (
          <AnswerActions
            ok={!!j?.ok}
            onNext={() => next()}
            onGuess={() => {
              onRecord('full:' + (q.item ? q.item.id : q.chord.quality), 'guess');
              setSession((s) => ({ ...s, c: Math.max(0, s.c - 1) }));
              next(true);
            }}
          />
        ) : q.duel ? (
          <div class="choices two">
            {q.duel.map((a) => (
              <button key={label(a)} class="choice" onClick={() => submit(a)}>
                <span>{label(a)}</span>
                <small>{itemOfAnswer(q.key, a)?.id}</small>
              </button>
            ))}
          </div>
        ) : (
          <>
            <span class="label">Fondamentale</span>
            <div class="chips roots">
              {Array.from({ length: 12 }, (_, i) => mod((q.key ? pcOf(q.key.tonic) : 0) + i, 12)).map((pc) => (
                <button key={pc} class="chip" aria-pressed={root === pc} onClick={() => pickRoot(pc)}>
                  {pcNameIn(pc, q.key)}
                </button>
              ))}
            </div>
            <span class="label">Nature</span>
            <div class="chips text">
              {q.qualities.map((k) => (
                <button key={k} class="chip" aria-pressed={quality === k} onClick={() => pickQuality(k)}>
                  {qName(k)}
                </button>
              ))}
            </div>
            <p class="muted small">{root === null && quality === null ? 'Choisis les deux : la réponse part dès que les deux sont choisis.' : root === null ? 'Et la fondamentale ?' : quality === null ? 'Et la nature ?' : ''}</p>
          </>
        )}
      </div>
    </div>
  );
}
