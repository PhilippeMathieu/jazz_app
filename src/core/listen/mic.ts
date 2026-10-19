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

/** À appeler depuis un geste (tap). Renvoie true si le micro est actif. */
export async function startMic(): Promise<boolean> {
  if (stream && state === 'on') return true;
  if (!navigator.mediaDevices?.getUserMedia) {
    setState('unsupported');
    return false;
  }
  setState('asking');
  try {
    const ctx = audio();
    setSession('play-and-record');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    const src = ctx.createMediaStreamSource(stream);
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

/** Dernière fenêtre courte : niveau et note détectée. */
export function readMono(): { level: number; pitch: PitchResult | null } | null {
  if (!monoAn) return null;
  monoAn.getFloatTimeDomainData(monoBuf);
  const level = rms(monoBuf);
  const sr = monoAn.context.sampleRate;
  return { level, pitch: level > 0 ? yin(monoBuf, sr, 150, 2200) : null };
}

/** Dernière grande fenêtre : niveau, chroma et note grave. */
export function readChord() {
  if (!chordAn) return null;
  if (chordBuf.length !== chordAn.fftSize) chordBuf = new Float32Array(chordAn.fftSize);
  chordAn.getFloatTimeDomainData(chordBuf);
  const level = rms(chordBuf);
  return { level, ...analyzeChordBuffer(chordBuf, chordAn.context.sampleRate) };
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
