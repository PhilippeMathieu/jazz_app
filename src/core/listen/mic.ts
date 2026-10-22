// Accès au micro et lecture des signaux pour la détection.
import { useEffect, useRef, useState } from 'preact/hooks';
import { audio } from '../audio/engine';
import { load, save } from '../storage';
import { PitchResult, analyzeChordBuffer, rms, yin } from './detect';
import { onsetDetector } from './onset';
import { floorOf, gainFor, gateFor } from './level';

export type MicState = 'off' | 'asking' | 'on' | 'denied' | 'unsupported' | 'error';

let stream: MediaStream | null = null;
let nodes: AudioNode[] = [];
let chordAn: AnalyserNode | null = null;
let monoAn: AnalyserNode | null = null;
let source: AudioNode | null = null;
let sinkNode: GainNode | null = null;
/** Amplification du micro (voir level.ts) et mesure du niveau brut. */
let preGain: GainNode | null = null;
let rawAn: AnalyserNode | null = null;
let levelTimer = 0;
let onsetNode: AudioNode | null = null;
const onsetListeners = new Set<(t: number) => void>();
/** Module d'attaques chargé (une fois par contexte audio). */
let workletReady: Promise<boolean> | null = null;
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
  /** Sensibilité : 1 par défaut ; plus haut, le seuil de silence descend. */
  sens: number;
}
export const micSettings = (): MicSettings => load('micro', { sens: 1 });
let sens = micSettings().sens;
export const saveMicSettings = (s: MicSettings) => {
  save('micro', s);
  sens = s.sens;
  updateLevel();
};

// ---------------------------------------------------------------- Niveau : bruit de fond, gain, seuil

const LEVELS = 150; // 15 s de mesures, toutes les 100 ms
const rawLevels: number[] = [];
const rawBuf = new Float32Array(2048);
const level = { floor: 0, gain: 30, gate: gateFor(0, 30) };
/** Mesure qui démarre : le gain par défaut (téléphone typique), corrigé dès 0,4 s de mesures. */

/** Seuil de silence actuel (après amplification) : sous ce niveau, pas de note. */
export const micGate = () => level.gate;
/** Bruit de fond mesuré (brut), amplification appliquée, seuil : pour l'écran Micro. */
export const micLevel = () => ({ ...level });

function updateLevel() {
  if (rawLevels.length < 4) return;
  const floor = floorOf(rawLevels);
  const gain = gainFor(floor);
  // Le gain ne change que s'il s'écarte nettement (± 25 %), et en douceur : pas de saut de niveau pendant le jeu.
  if (preGain && Math.abs(Math.log(gain / level.gain)) > 0.22) {
    preGain.gain.setTargetAtTime(gain, preGain.context.currentTime, 0.3);
    level.gain = gain;
  }
  level.floor = floor;
  level.gate = gateFor(floor, level.gain, sens);
  if (onsetNode instanceof AudioWorkletNode) onsetNode.port.postMessage(level.gate);
}

function measureLevel() {
  if (!rawAn) return;
  rawAn.getFloatTimeDomainData(rawBuf);
  rawLevels.push(rms(rawBuf));
  if (rawLevels.length > LEVELS) rawLevels.shift();
  updateLevel();
}

let pending: Promise<boolean> | null = null;
/** Incrémenté à chaque arrêt : une ouverture en cours devenue obsolète se referme d'elle-même. */
let generation = 0;

let echoOn = false;

/**
 * À appeler depuis un geste (tap). Renvoie true si le micro est actif.
 * echo : annulation d'écho du téléphone (le rythme n'a besoin que des attaques, et il ne faut pas
 * que le micro entende le métronome du haut-parleur) ; sans, le son est plus fidèle (hauteur, accords).
 */
export function startMic(o: { echo?: boolean } = {}): Promise<boolean> {
  const echo = !!o.echo;
  if (stream && state === 'on' && echo === echoOn) return Promise.resolve(true);
  if (pending) return pending;
  if (stream) stopMic();
  echoOn = echo;
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
      audio: { echoCancellation: echoOn, noiseSuppression: false, autoGainControl: false }
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
    // Niveau brut (bruit de fond), puis amplification : tout le reste écoute le signal amplifié.
    rawAn = ctx.createAnalyser();
    rawAn.fftSize = 2048;
    src.connect(rawAn);
    const pre = ctx.createGain();
    pre.gain.value = level.gain;
    src.connect(pre);
    preGain = pre;
    // Accords : signal non filtré, grande fenêtre (≈ 0,35 s) pour séparer les notes graves.
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
    pre.connect(chordAn);
    pre.connect(hp);
    hp.connect(lp);
    lp.connect(monoAn);
    chordAn.connect(sink);
    monoAn.connect(sink);
    rawAn.connect(sink);
    sink.connect(ctx.destination);
    nodes = [src, rawAn, pre, hp, lp, chordAn, monoAn, sink];
    source = pre;
    rawSource = src;
    rawLevels.length = 0;
    clearInterval(levelTimer);
    levelTimer = window.setInterval(measureLevel, 100);
    sinkNode = sink;
    setState('on');
    if (onsetListeners.size) void ensureOnsets();
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
  onsetNode?.disconnect();
  onsetNode = null;
  source = sinkNode = null;
  rawSource = null;
  preGain = null;
  rawAn = null;
  clearInterval(levelTimer);
  nodes = [];
  stream = null;
  chordAn = monoAn = null;
  setSession('playback');
  if (state !== 'denied' && state !== 'unsupported') setState('off');
}

const monoBuf = new Float32Array(2048);
let chordBuf = new Float32Array(16384);

/** Dernière fenêtre courte : niveau et note détectée (rien sous le seuil). */
export function readMono(gate = level.gate): { level: number; pitch: PitchResult | null } | null {
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
export function readNote(gate = level.gate): { level: number; pitch: PitchResult | null } | null {
  if (!chordAn) return null;
  if (chordBuf.length !== chordAn.fftSize) chordBuf = new Float32Array(chordAn.fftSize);
  chordAn.getFloatTimeDomainData(chordBuf);
  noteBuf.set(chordBuf.subarray(chordBuf.length - noteBuf.length));
  const level = rms(noteBuf);
  return { level, pitch: level > Math.max(gate, 1e-5) ? yin(noteBuf, chordAn.context.sampleRate, 60, 2200) : null };
}

// ---------------------------------------------------------------- Enregistrement de diagnostic

let rawSource: MediaStreamAudioSourceNode | null = null;

/** Enregistre le signal brut du micro (avant amplification) pendant `seconds` secondes. */
export function recordRaw(seconds: number, onProgress?: (s: number) => void): Promise<{ data: Float32Array; sampleRate: number } | null> {
  if (!rawSource || !sinkNode) return Promise.resolve(null);
  const ctx = rawSource.context as AudioContext;
  const total = Math.round(seconds * ctx.sampleRate);
  const data = new Float32Array(total);
  let filled = 0;
  const sp = ctx.createScriptProcessor(4096, 1, 1);
  const sink = sinkNode;
  rawSource.connect(sp);
  sp.connect(sink);
  return new Promise((done) => {
    sp.onaudioprocess = (e) => {
      const ch = e.inputBuffer.getChannelData(0);
      const n = Math.min(ch.length, total - filled);
      data.set(ch.subarray(0, n), filled);
      filled += n;
      onProgress?.(filled / ctx.sampleRate);
      if (filled >= total || !rawSource) {
        sp.disconnect();
        rawSource?.disconnect(sp);
        sp.onaudioprocess = null;
        done(filled ? { data: data.subarray(0, filled), sampleRate: ctx.sampleRate } : null);
      }
    };
  });
}

/** WAV 32 bits flottants, mono : le signal tel quel, même très faible. */
export function wavOf(data: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + data.length * 4);
  const v = new DataView(buf);
  const str = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + data.length * 4, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 3, true); // flottant IEEE
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 32, true);
  str(36, 'data');
  v.setUint32(40, data.length * 4, true);
  for (let i = 0; i < data.length; i++) v.setFloat32(44 + i * 4, data[i], true);
  return new Blob([buf], { type: 'audio/wav' });
}

// ---------------------------------------------------------------- Attaques (rythme)

const WORKLET = (gate: number) => `const make = ${onsetDetector.toString()};
class OnsetProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.d = make(sampleRate); this.gate = ${gate}; this.port.onmessage = (e) => { this.gate = e.data; }; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) { const t = this.d(ch, currentTime, this.gate); if (t >= 0) this.port.postMessage(t); }
    return true;
  }
}
registerProcessor('onsets', OnsetProcessor);`;

async function loadWorklet(ctx: AudioContext): Promise<boolean> {
  if (!ctx.audioWorklet) return false;
  workletReady ??= (async () => {
    const url = URL.createObjectURL(new Blob([WORKLET(level.gate)], { type: 'application/javascript' }));
    try {
      await ctx.audioWorklet.addModule(url);
      return true;
    } catch {
      return false;
    } finally {
      URL.revokeObjectURL(url);
    }
  })();
  return workletReady;
}

async function ensureOnsets() {
  if (onsetNode || !source || !sinkNode) return;
  const ctx = source.context as AudioContext;
  const emit = (t: number) => onsetListeners.forEach((l) => l(t));
  if (await loadWorklet(ctx)) {
    if (!source || !sinkNode || onsetNode) return; // micro coupé entre-temps
    const node = new AudioWorkletNode(ctx, 'onsets');
    node.port.postMessage(level.gate);
    node.port.onmessage = (e) => emit(e.data as number);
    source.connect(node);
    node.connect(sinkNode);
    onsetNode = node;
  } else {
    // Repli pour les navigateurs sans AudioWorklet.
    const sp = ctx.createScriptProcessor(256, 1, 1);
    const d = onsetDetector(ctx.sampleRate);
    sp.onaudioprocess = (e) => {
      const ch = e.inputBuffer.getChannelData(0);
      const t0 = ctx.currentTime - 256 / ctx.sampleRate;
      for (let i = 0; i < 256; i += 128) {
        const t = d(ch.subarray(i, i + 128), t0 + i / ctx.sampleRate, level.gate);
        if (t >= 0) emit(t);
      }
    };
    source.connect(sp);
    sp.connect(sinkNode);
    onsetNode = sp;
  }
}

/** Écoute les attaques jouées au piano (instants sur l'horloge audio). Renvoie la fonction d'arrêt. */
export function listenOnsets(f: (t: number) => void): () => void {
  onsetListeners.add(f);
  void ensureOnsets();
  return () => {
    onsetListeners.delete(f);
    if (!onsetListeners.size && onsetNode) {
      onsetNode.disconnect();
      onsetNode = null;
    }
  };
}

/** Dernière grande fenêtre : niveau, chroma et note grave (null sous le seuil). */
export function readChord(gate = level.gate) {
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
