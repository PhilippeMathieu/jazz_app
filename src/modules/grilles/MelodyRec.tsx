// La mélodie d'un morceau : l'élève la joue une fois au piano, avec l'accompagnement ; l'appli la retient
// (sur l'appareil) et la rejoue avec la case « Mélodie » du lecteur. On peut enregistrer partie par partie.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { audio, now } from '../../core/audio/engine';
import { MIC_MESSAGES, listenOnsets, micGate, readMono, startMic, stopMic, useMicLoop, useMicState } from '../../core/listen/mic';
import { NoteTracker } from '../../core/listen/tracker';
import { BeatMap, Frame, MelNote, melodyOf, replaceRange, saveMelody, shiftMelody, toMelody, transcribe } from '../../core/melody/melody';
import { offsetOf } from '../../core/rhythm/offset';
import { plainName } from '../../core/theory/notes';
import { PlayerApi } from '../../ui/usePlayer';

/** La mélodie enregistrée d'un morceau (tonalité d'origine) et sa version transposée pour le lecteur. */
export function useMelodyStore(chartId: string, shift: number) {
  const [notes, setNotes] = useState<MelNote[]>(() => melodyOf(chartId));
  useEffect(() => setNotes(melodyOf(chartId)), [chartId]);
  const shifted = useMemo(() => shiftMelody(notes, shift), [notes, shift]);
  const set = (n: MelNote[]) => {
    saveMelody(chartId, n);
    setNotes(n);
  };
  return { notes, shifted, set };
}
export type MelodyStore = ReturnType<typeof useMelodyStore>;

type Phase = 'idle' | 'mic' | 'rec' | 'done' | 'empty' | 'error';
/** Retard du micro par défaut (ms), tant que le réglage n'a pas été fait (exercices de rythme). */
const MIC_LATENCY = 60;

/** barOf : mesure d'un temps de la grille. */
export function useMelodyRecorder(player: PlayerApi, store: MelodyStore, shift: number, barOf: (beat: number) => number) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [live, setLive] = useState<{ count: number; last: string | null }>({ count: 0, last: null });
  const [result, setResult] = useState<{ n: number; fromBar: number; toBar: number } | null>(null);
  const [error, setError] = useState('');
  const mic = useMicState();
  /** Vrai pendant toute la lecture d'enregistrement (lu par la vue, sans attendre un rendu). */
  const active = useRef(false);
  const rec = useRef<{ frames: Frame[]; onsets: number[]; map: BeatMap | null; from: number; micWasOn: boolean; unsub: () => void; tracker: NoteTracker }>();
  const undo = useRef<MelNote[] | null>(null);

  const record = async (bar: number) => {
    audio();
    setError('');
    setResult(null);
    const micWasOn = mic === 'on';
    setPhase('mic');
    const ok = await startMic();
    if (!ok) {
      setPhase('error');
      return;
    }
    const r = { frames: [] as Frame[], onsets: [] as number[], map: null as BeatMap | null, from: player.beatOfBar(bar), micWasOn, unsub: () => {}, tracker: new NoteTracker() };
    r.unsub = listenOnsets((t) => r.onsets.push(t));
    rec.current = r;
    active.current = true;
    // Le piano de l'appli se tait (le micro l'entendrait) ; la basse et la batterie donnent l'harmonie et le tempo.
    player.startWith(bar, { comp: false, countIn: true, melodyOn: false });
    r.map = player.beatMap();
    setLive({ count: 0, last: null });
    setPhase('rec');
  };

  // Pendant l'enregistrement : la hauteur toutes les 40 ms (et un retour : la dernière note entendue).
  useMicLoop(
    phase === 'rec',
    () => {
      const r = rec.current;
      const m = readMono();
      if (!r || !m) return;
      const t = now();
      r.frames.push({ t, midi: m.pitch?.midi ?? null, clarity: m.pitch?.clarity ?? 0, level: m.level });
      const ev = r.tracker.push(m.pitch, m.level, t * 1000, micGate());
      if (ev && ev.midi >= 55) setLive((l) => ({ count: l.count + 1, last: plainName(ev.midi) }));
    },
    40
  );

  const finish = () => {
    const r = rec.current;
    if (!r) return;
    rec.current = undefined;
    const end = r.map ? Math.min(player.length(), (now() - r.map.anchor) / r.map.spb) : 0;
    player.stop();
    active.current = false;
    r.unsub();
    if (!r.micWasOn) stopMic();
    const heard = transcribe(r.frames, r.onsets, { gate: micGate() });
    const fresh = r.map && end > r.from ? toMelody(heard, r.map, { latency: (offsetOf('mic') ?? MIC_LATENCY) / 1000, shift, from: r.from, to: end }) : [];
    if (!fresh.length) return setPhase('empty');
    undo.current = store.notes;
    store.set(replaceRange(store.notes, fresh, r.from, end));
    if (!player.prefs.melody) player.set('melody', true);
    setResult({ n: fresh.length, fromBar: barOf(fresh[0].b), toBar: barOf(fresh[fresh.length - 1].b) });
    setPhase('done');
  };

  // Fin : bouton stop, ou fin de la grille (on n'enregistre qu'un passage).
  useEffect(() => {
    if (phase === 'rec' && (!player.playing || (player.pos?.chorus ?? 0) > 0)) finish();
  }, [player.playing, player.pos?.chorus, phase]);
  // Écran quitté pendant l'enregistrement.
  useEffect(
    () => () => {
      rec.current?.unsub();
      active.current = false;
    },
    []
  );

  return {
    phase,
    live,
    result,
    error: phase === 'error' ? MIC_MESSAGES[mic] ?? error : '',
    active,
    record,
    stop: finish,
    undo: () => {
      if (undo.current) store.set(undo.current);
      undo.current = null;
      setPhase('idle');
    },
    clear: () => {
      undo.current = store.notes;
      store.set([]);
      setPhase('idle');
    },
    dismiss: () => setPhase('idle')
  };
}
export type MelodyRecorder = ReturnType<typeof useMelodyRecorder>;

/** Ligne d'état sous la barre de lecture : enregistrement en cours, résultat. */
export function RecStatus({ r }: { r: MelodyRecorder }) {
  if (r.phase === 'mic') return <p class="player-note rec-note">Ouverture du micro…</p>;
  if (r.phase === 'rec')
    return (
      <p class="player-note rec-note">
        <i class="rec" /> Enregistrement : joue la mélodie, main droite seule.
        {r.live.count ? ` ${r.live.count} note${r.live.count > 1 ? 's' : ''}, dernière : ${r.live.last}.` : ' Après le décompte.'} Stop pour finir.
      </p>
    );
  if (r.phase === 'done' && r.result)
    return (
      <p class="player-note rec-note">
        Mélodie gardée : {r.result.n} notes, mesures {r.result.fromBar + 1} à {r.result.toBar + 1}. Lance la lecture pour l’entendre.{' '}
        <button class="linkbtn" onClick={r.undo}>
          Annuler
        </button>
      </p>
    );
  if (r.phase === 'empty')
    return (
      <p class="player-note rec-note">
        Aucune note entendue. Rapproche le téléphone du piano, ou vérifie le micro dans Réglages › Tester le micro.{' '}
        <button class="linkbtn" onClick={r.dismiss}>
          OK
        </button>
      </p>
    );
  if (r.phase === 'error')
    return (
      <p class="player-note rec-note">
        {r.error}{' '}
        <button class="linkbtn" onClick={r.dismiss}>
          OK
        </button>
      </p>
    );
  return null;
}

/** Dans le tiroir « Instruments » : enregistrer, effacer. */
export function MelodyPanel({ r, store, fromBar, onRecord }: { r: MelodyRecorder; store: MelodyStore; fromBar: number; onRecord: () => void }) {
  const has = store.notes.length > 0;
  return (
    <section class="mel-panel">
      <h2 class="label">Mélodie</h2>
      <p class="muted small">
        {has
          ? `${store.notes.length} notes enregistrées. Pour refaire une partie : dans « Accords », touche l’accord où commencer, puis « Enregistrer ».`
          : 'Joue la mélodie une fois au piano, main droite seule, avec la basse et la batterie : l’appli la retient et la rejoue avec la case « Mélodie ». Elle reste sur ce téléphone.'}{' '}
        Tu peux ralentir pour l’enregistrer : elle suivra ensuite le tempo et la tonalité choisis. Avec des écouteurs, le micro n’entend que ton piano.
      </p>
      <div class="row-actions">
        <button
          class="btn primary grow"
          disabled={r.phase === 'rec' || r.phase === 'mic'}
          onClick={() => {
            onRecord();
            void r.record(fromBar);
          }}
        >
          Enregistrer depuis la mesure {fromBar + 1}
        </button>
        {has ? (
          <button class="btn" onClick={r.clear}>
            Effacer
          </button>
        ) : null}
      </div>
    </section>
  );
}
