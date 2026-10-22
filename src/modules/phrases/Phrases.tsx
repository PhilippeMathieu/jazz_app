// Phrases : vocabulaire sur ii–V–I en appel-réponse. L'appli joue une phrase, tu la rejoues ; le micro vérifie les notes dans l'ordre.
import { useEffect, useRef, useState } from 'preact/hooks';
import { silence } from '../../core/audio/engine';
import { keyLabel } from '../../core/chart/model';
import { pick } from '../../core/random';
import { load, save } from '../../core/storage';
import { report } from '../../core/events';
import { micSettings, readMono, useMicLoop, useMicRelease, useMicState } from '../../core/listen/mic';
import { NoteTracker } from '../../core/listen/tracker';
import { plainName } from '../../core/theory/notes';
import { MicPill } from '../../ui/MicPill';
import { PlayIcon } from '../../ui/icons';
import { PhraseStaff } from '../../ui/PhraseStaff';
import { useWakeLock } from '../../ui/wakeLock';
import { CYCLE, LINES, Line, Match, Phrase, chordNames, lineById, matchPhrase, noteLabel, phraseIn } from './lines';
import { playCall } from './play';

type Keys = 'cycle' | 'C' | 'random';
interface Saved {
  level: number;
  line: string;
  keys: Keys;
  tempo: number;
  /** Partition affichée pendant l'appel (sinon : à l'oreille, montrée après). */
  show: boolean;
  /** Accompagnement pendant la réponse (au casque). */
  backing: boolean;
  /** Tonalités réussies au micro, par phrase (classes de hauteur de la tonique). */
  done: Record<string, number[]>;
}
const DEFAULT: Saved = { level: 0, line: 'arp1357', keys: 'cycle', tempo: 100, show: true, backing: false, done: {} };
/** Silence après la dernière note : la réponse est terminée. */
const END_SILENCE = 2500;

/** Une phrase en appel-réponse, dans les tonalités par quartes. */
export function PhraseRun({ line, onExit }: { line: string; onExit: () => void }) {
  useMicRelease();
  const [s, setS] = useState<Saved>(() => ({ ...load('phrases', DEFAULT), line, keys: 'cycle' }));
  useEffect(() => save('phrases', s), [s]);
  const l = lineById(line) ?? LINES[0];
  return <Run s={s} line={l} setS={setS} onEnd={onExit} />;
}

type Phase = 'call' | 'answer' | 'result';

function Run({ s, line, setS, onEnd }: { s: Saved; line: Line; setS: (f: Saved) => void; onEnd: () => void }) {
  const order = s.keys === 'C' ? [0] : CYCLE;
  const [k, setK] = useState(0);
  const pcOfStep = (i: number) => (s.keys === 'random' ? pick(CYCLE) : order[i % order.length]);
  const [pc, setPc] = useState(() => pcOfStep(0));
  const p: Phrase = phraseIn(line, pc);
  const [phase, setPhaseState] = useState<Phase>('call');
  const phaseRef = useRef<Phase>('call');
  const setPhase = (x: Phase) => {
    phaseRef.current = x;
    setPhaseState(x);
  };
  const [cur, setCur] = useState(-1);
  const [played, setPlayed] = useState<number[]>([]);
  const [result, setResult] = useState<Match | null>(null);
  const [score, setScore] = useState({ ok: 0, total: 0 });
  const mic = useMicState();
  const listening = mic === 'on';
  const timers = useRef<number[]>([]);
  const tracker = useRef(new NoteTracker(micSettings().gate));
  const lastNote = useRef(0);
  const started = useRef(0);
  const doneRef = useRef(s.done);
  useWakeLock(true);

  const clear = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  const call = (phrase: Phrase) => {
    clear();
    silence();
    setPhase('call');
    setPlayed([]);
    setResult(null);
    const { at, total } = playCall(phrase, s.tempo, { phrase: true, backing: true });
    at.forEach((t, i) => timers.current.push(window.setTimeout(() => setCur(i), t * 1000)));
    timers.current.push(window.setTimeout(() => answer(phrase), total * 1000 - 200));
  };
  const answer = (phrase: Phrase) => {
    clear();
    silence();
    setCur(-1);
    setPhase('answer');
    tracker.current = new NoteTracker(micSettings().gate);
    lastNote.current = 0;
    started.current = performance.now();
    if (s.backing) playCall(phrase, s.tempo, { phrase: false, backing: true, countIn: true });
  };
  useEffect(() => {
    call(p);
    return () => {
      clear();
      silence();
    };
  }, []);

  const finish = (notes: number[], selfOk?: boolean) => {
    if (phaseRef.current !== 'answer') return;
    clear();
    silence();
    const m = matchPhrase(
      p.notes.map((n) => n.midi),
      notes
    );
    const ok = selfOk ?? m.pass;
    setResult(selfOk === undefined ? m : { ...m, pass: ok, ok: m.ok.map(() => ok) });
    setPhase('result');
    setScore((x) => ({ ok: x.ok + (ok ? 1 : 0), total: x.total + 1 }));
    if (selfOk === undefined) {
      report({ type: 'answer', exo: 'phrases', level: s.level, ok, ms: performance.now() - started.current });
      if (ok) {
        const d = doneRef.current[line.id] ?? [];
        if (!d.includes(pc)) {
          doneRef.current = { ...doneRef.current, [line.id]: [...d, pc] };
          setS({ ...s, done: doneRef.current });
        }
      }
    }
  };

  // Réponse au micro : chaque nouvelle note est ajoutée ; fin dès que la phrase est complète, ou après un silence.
  useMicLoop(
    listening && phase === 'answer',
    () => {
      const t = performance.now();
      const r = readMono(tracker.current.gate);
      if (r) {
        const ev = tracker.current.push(r.pitch, r.level, t);
        if (ev) {
          lastNote.current = t;
          setPlayed((pl) => {
            const next = [...pl, ev.midi];
            if (matchPhrase(p.notes.map((n) => n.midi), next).pass) window.setTimeout(() => finish(next), 300);
            return next;
          });
        }
      }
      if (lastNote.current && t - lastNote.current > END_SILENCE) {
        lastNote.current = 0;
        setPlayed((pl) => (window.setTimeout(() => finish(pl), 0), pl));
      }
    },
    40
  );

  const nextKey = () => {
    const nk = k + 1;
    const npc = pcOfStep(nk);
    setK(nk);
    setPc(npc);
    call(phraseIn(line, npc));
  };

  const showStaff = s.show || phase === 'result';
  const states = result ? result.ok.map((o) => (o ? 'ok' : 'bad') as 'ok' | 'bad') : [];
  const missed = result ? p.notes.filter((_, i) => !result.ok[i]).map((n) => noteLabel(n.w)) : [];
  return (
    <div class="screen play-screen phrases-run">
      <header class="topbar">
        <button
          class="btn ghost sm"
          onClick={() => {
            clear();
            silence();
            onEnd();
          }}
        >
          Arrêter
        </button>
        <span class="play-meta">
          {score.ok}/{score.total}
        </span>
        <MicPill />
      </header>
      <section class="ear-stage">
        <p class="full-ref">
          {line.name} en <b>{keyLabel(p.key)}</b>
          {s.keys === 'cycle' ? <span class="muted small"> · {(k % 12) + 1}/12</span> : null}
        </p>
        {showStaff ? (
          <PhraseStaff notes={p.notes} chords={chordNames(p)} states={states} current={cur} label={`${line.name} en ${keyLabel(p.key)}`} />
        ) : (
          <p class="phrase-chords mono">{chordNames(p).join(' | ')}</p>
        )}
        {phase === 'call' ? (
          <div class="phase-line">
            <span>
              <i class="rec off" /> Écoute, puis rejoue
            </span>
          </div>
        ) : phase === 'answer' ? (
          <div class="phase-line">
            <span>
              <i class={'rec' + (listening ? '' : ' off')} /> {listening ? (s.backing ? 'À toi, après le décompte' : 'À toi : rejoue la phrase') : 'À toi : rejoue la phrase, puis dis si c’était juste'}
            </span>
            {listening ? (
              <span class="phrase-played mono">{played.length ? played.slice(-12).map((m) => plainName(m)).join(' ') : '…'}</span>
            ) : null}
          </div>
        ) : result ? (
          <div class="fb">
            <p class={'verdict ' + (result.pass ? 'ok' : 'bad')}>
              {result.pass ? `Juste : ${p.notes.length}/${p.notes.length}.` : listening || played.length ? `${result.matched}/${p.notes.length} notes dans l’ordre.` : 'À retravailler.'}
            </p>
            {!result.pass && missed.length && (listening || played.length) ? <p class="muted">Manquées (en rouge) : {missed.join(' ')}.</p> : null}
            {result.pass && result.extra ? <p class="muted">{result.extra} note{result.extra > 1 ? 's' : ''} en plus, sans gravité.</p> : null}
            <p class="muted small">{line.tip}</p>
            <p class="muted small">
              {(s.done[line.id] ?? []).length}/12 tonalités réussies au micro pour cette phrase.
            </p>
          </div>
        ) : null}
      </section>
      <div class="thumb-zone">
        {phase === 'answer' ? (
          listening ? (
            <div class="row-actions">
              <button class="btn" onClick={() => call(p)}>
                Réécouter
              </button>
              <button class="btn primary grow" onClick={() => finish(played)}>
                J’ai fini
              </button>
            </div>
          ) : (
            <div class="row-actions">
              <button class="btn" onClick={() => finish([], false)}>
                À retravailler
              </button>
              <button class="btn primary grow" onClick={() => finish([], true)}>
                Juste
              </button>
            </div>
          )
        ) : phase === 'result' ? (
          <div class="row-actions">
            <button class={'btn' + (result?.pass ? '' : ' primary grow')} onClick={() => call(p)}>
              <PlayIcon /> Encore
            </button>
            <button class={'btn' + (result?.pass ? ' primary grow' : '')} onClick={nextKey}>
              {s.keys === 'C' ? 'Encore en C' : 'Tonalité suivante'}
            </button>
          </div>
        ) : (
          <div class="row-actions">
            <button class="btn" onClick={() => answer(p)}>
              Passer l’écoute
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
