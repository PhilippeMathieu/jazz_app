// Accès au micro et lecture des signaux pour la détection.
import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/engine';
import { load, save } from '../storage';
import { PitchResult, analyzeChordBuffer, rms, yin } from './detect';

export type MicState = 'off' | 'asking' | 'on' | 'denied' | 'unsupported' | 'error';

let stream: MediaStream | null = null;
let nodes: AudioNode[] = [];
let chordAn: AnalyserNode | null = null;
let monoAn: AnalyserNode | null = null;
let state: MicState = 'off';
const listeners = new Set<(s: MicState) => void>();
const setState = (s: MicState) => {
  state = s;
  listeners.forEach((f) => f(s));
};

function setSession(type: 'playback' | 'play-and-record') {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    if (nav.audioSession) nav.audioSession.type = type;
  } catch {
    /* non pris en charge */
  }
}

export interface MicSettings {
  /** Seuil de niveau (RMS) sous lequel on considère qu'il n'y a pas de son. */
  gate: number;
}
export const micSettings = (): MicSettings => load('micro', { gate: 0.006 });
export const saveMicSettings = (s: MicSettings) => save('micro', s);

let pending: Promise<boolean> | null = null;
/** Incrémenté à chaque arrêt : une ouverture en cours devenue obsolète se referme d'elle-même. */
let generation = 0;

/** À appeler depuis un geste (tap). Renvoie true si le micro est actif. */
export function startMic(): Promise<boolean> {
  if (stream && state === 'on') return Promise.resolve(true);
  if (pending) return pending;
  pending = open().finally(() => {
    pending = null;
  });
  return pending;
}

async function open(): Promise<boolean> {
  if (!navigator.mediaDevices?.getUserMedia) {
    setState('unsupported');
    return false;
  }
  setState('asking');
  const gen = generation;
  try {
    const ctx = audio();
    setSession('play-and-record');
    const s = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    if (gen !== generation) {
      // L'écran a été quitté pendant la demande d'autorisation.
      s.getTracks().forEach((t) => t.stop());
      setSession('playback');
      return false;
    }
    stream = s;
    // Appel, Siri, autre appli : le micro est coupé par le système.
    s.getAudioTracks().forEach((t) => (t.onended = () => stopMic()));
    const src = ctx.createMediaStreamSource(s);
    // Accords : signal brut, grande fenêtre (≈ 0,35 s) pour séparer les notes graves.
    chordAn = ctx.createAnalyser();
    chordAn.fftSize = 16384;
    chordAn.smoothingTimeConstant = 0;
    // Note seule : bande passante de la main droite, fenêtre courte pour la réactivité.
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 150;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    monoAn = ctx.createAnalyser();
    monoAn.fftSize = 2048;
    monoAn.smoothingTimeConstant = 0;
    // Certains navigateurs ne font tourner un nœud que s'il mène à la sortie : on le relie à un volume nul.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    src.connect(chordAn);
    src.connect(hp);
    hp.connect(lp);
    lp.connect(monoAn);
    chordAn.connect(sink);
    monoAn.connect(sink);
    sink.connect(ctx.destination);
    nodes = [src, hp, lp, chordAn, monoAn, sink];
    setState('on');
    return true;
  } catch (e) {
    setSession('playback');
    setState((e as Error).name === 'NotAllowedError' ? 'denied' : 'error');
    return false;
  }
}

export function stopMic() {
  generation++;
  stream?.getTracks().forEach((t) => t.stop());
  nodes.forEach((n) => n.disconnect());
  nodes = [];
  stream = null;
  chordAn = monoAn = null;
  setSession('playback');
  if (state !== 'denied' && state !== 'unsupported') setState('off');
}

const monoBuf = new Float32Array(2048);
let chordBuf = new Float32Array(16384);

/** Dernière fenêtre courte : niveau et note détectée (rien sous le seuil). */
export function readMono(gate = 0): { level: number; pitch: PitchResult | null } | null {
  if (!monoAn) return null;
  monoAn.getFloatTimeDomainData(monoBuf);
  const level = rms(monoBuf);
  return { level, pitch: level > Math.max(gate, 1e-5) ? yin(monoBuf, monoAn.context.sampleRate, 150, 2200) : null };
}

const noteBuf = new Float32Array(3072);
/**
 * Note seule sur toute la tessiture (jusqu'à C2) : fin de la grande fenêtre, signal non filtré.
 * Plus lent que readMono mais juste dans les graves (lecture en clé de fa).
 */
export function readNote(gate = 0): { level: number; pitch: PitchResult | null } | null {
  if (!chordAn) return null;
  if (chordBuf.length !== chordAn.fftSize) chordBuf = new Float32Array(chordAn.fftSize);
  chordAn.getFloatTimeDomainData(chordBuf);
  noteBuf.set(chordBuf.subarray(chordBuf.length - noteBuf.length));
  const level = rms(noteBuf);
  return { level, pitch: level > Math.max(gate, 1e-5) ? yin(noteBuf, chordAn.context.sampleRate, 60, 2200) : null };
}

/** Dernière grande fenêtre : niveau, chroma et note grave (null sous le seuil). */
export function readChord(gate = 0) {
  if (!chordAn) return null;
  if (chordBuf.length !== chordAn.fftSize) chordBuf = new Float32Array(chordAn.fftSize);
  chordAn.getFloatTimeDomainData(chordBuf);
  const level = rms(chordBuf);
  if (level <= Math.max(gate, 1e-5)) return { level, analysis: null };
  return { level, analysis: analyzeChordBuffer(chordBuf, chordAn.context.sampleRate) };
}

export function useMicState(): MicState {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    setS(state);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

/** Appelle f à intervalle régulier tant que active est vrai et que le micro est ouvert. */
export function useMicLoop(active: boolean, f: () => void, ms = 60) {
  const ref = useRef(f);
  ref.current = f;
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      if (state === 'on') ref.current();
    }, ms);
    return () => clearInterval(id);
  }, [active, ms]);
}

/** Coupe le micro en quittant l'écran. */
export function useMicRelease() {
  useEffect(() => () => stopMic(), []);
}

export const MIC_MESSAGES: Record<MicState, string> = {
  off: 'Micro coupé.',
  asking: 'Autorise le micro dans la fenêtre d’iOS.',
  on: 'Micro actif.',
  denied: 'Micro refusé. Réglages iPhone → Safari → Micro (ou Réglages → Confidentialité → Micro), puis réessaie.',
  unsupported: 'Ce navigateur ne donne pas accès au micro.',
  error: 'Le micro n’a pas pu démarrer. Ferme les autres applis qui l’utilisent et réessaie.'
};
