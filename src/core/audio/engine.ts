// Moteur audio : piano échantillonné (Salamander Grand Piano, CC BY 3.0),
// basse et batterie synthétisées. Tout est planifié sur l'horloge de l'AudioContext.

const SAMPLES: [string, number][] = [
  ['A1', 33], ['C2', 36], ['Ds2', 39], ['Fs2', 42], ['A2', 45], ['C3', 48], ['Ds3', 51], ['Fs3', 54],
  ['A3', 57], ['C4', 60], ['Ds4', 63], ['Fs4', 66], ['A4', 69], ['C5', 72], ['Ds5', 75], ['Fs5', 78],
  ['A5', 81], ['C6', 84], ['Ds6', 87], ['Fs6', 90], ['A6', 93], ['C7', 96]
];

let ctx: AudioContext | null = null;
let master: GainNode;
let pianoBus: GainNode;
let bassBus: GainNode;
let drumBus: GainNode;
const buffers = new Map<number, AudioBuffer>();
let loading: Promise<void> | null = null;
let noise: AudioBuffer | null = null;
const live = new Set<GainNode>();

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';
let loadState: LoadState = 'idle';
const listeners = new Set<(s: LoadState) => void>();
export const onLoadState = (f: (s: LoadState) => void) => {
  listeners.add(f);
  f(loadState);
  return () => listeners.delete(f);
};
const setLoad = (s: LoadState) => {
  loadState = s;
  listeners.forEach((f) => f(s));
};

/** À appeler depuis un geste utilisateur (tap) : iOS n'autorise le son qu'après. */
export function audio(): AudioContext {
  if (!ctx) {
    // iOS : joue même si le bouton silencieux est activé.
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* non pris en charge */
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(comp);
    comp.connect(ctx.destination);
    pianoBus = ctx.createGain();
    pianoBus.gain.value = 1;
    pianoBus.connect(master);
    bassBus = ctx.createGain();
    bassBus.gain.value = 0.85;
    bassBus.connect(master);
    drumBus = ctx.createGain();
    drumBus.gain.value = 0.5;
    drumBus.connect(master);
  }
  if (loadState === 'idle' || loadState === 'error') void loadPiano();
  if (ctx.state !== 'running') void ctx.resume();
  return ctx;
}
export const now = () => (ctx ? ctx.currentTime : 0);

/** Charge les échantillons manquants ; en cas d'échec, on réessaiera au prochain son. */
function loadPiano(): Promise<void> {
  if (loading) return loading;
  setLoad('loading');
  const base = import.meta.env.BASE_URL + 'samples/piano/';
  loading = Promise.all(
    SAMPLES.filter(([, midi]) => !buffers.has(midi)).map(async ([name, midi]) => {
      const res = await fetch(base + name + '.mp3');
      if (!res.ok) throw new Error(`${name} : ${res.status}`);
      const arr = await res.arrayBuffer();
      const buf = await new Promise<AudioBuffer>((ok, ko) => ctx!.decodeAudioData(arr, ok, ko));
      buffers.set(midi, buf);
    })
  )
    .then(() => setLoad('ready'))
    .catch(() => setLoad('error'))
    .finally(() => {
      loading = null;
    });
  return loading;
}

function track(g: GainNode, end: number) {
  live.add(g);
  setTimeout(() => live.delete(g), Math.max(0, (end - now()) * 1000) + 200);
}

/** Coupe tout ce qui sonne (fondu de 40 ms). */
export function silence() {
  if (!ctx) return;
  const t = ctx.currentTime;
  live.forEach((g) => {
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.setTargetAtTime(0, t, 0.015);
    } catch {
      /* déjà arrêté */
    }
  });
  live.clear();
}

/** Note de piano. vel 0..1, dur en secondes (durée tenue avant relâchement). */
export function piano(midi: number, when: number, dur: number, vel = 0.6) {
  const a = audio();
  const t = Math.max(when, a.currentTime);
  if (buffers.size < SAMPLES.length) return synthPiano(midi, t, dur, vel);
  let best = SAMPLES[0][1];
  for (const [, m] of SAMPLES) if (Math.abs(m - midi) < Math.abs(best - midi)) best = m;
  const buf = buffers.get(best);
  if (!buf) return synthPiano(midi, t, dur, vel);
  const src = a.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, (midi - best) / 12);
  const g = a.createGain();
  const level = 0.15 + vel * vel * 0.85;
  g.gain.setValueAtTime(level, t);
  g.gain.setValueAtTime(level, t + dur);
  g.gain.setTargetAtTime(0, t + dur, 0.12);
  src.connect(g);
  g.connect(pianoBus);
  src.start(t);
  src.stop(t + dur + 1.2);
  track(g, t + dur + 1.2);
}

/** Piano de secours tant que les échantillons ne sont pas chargés. */
function synthPiano(midi: number, t: number, dur: number, vel: number) {
  const a = ctx!;
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const len = Math.min(dur + 0.6, 4);
  const out = a.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(vel * 0.35, t + 0.006);
  out.gain.exponentialRampToValueAtTime(vel * 0.12, t + 0.3);
  out.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.min(9000, f * 7 + 500);
  lp.connect(out);
  out.connect(pianoBus);
  [1, 0.42, 0.24, 0.12, 0.07].forEach((amp, i) => {
    const n = i + 1;
    const o = a.createOscillator();
    o.frequency.value = f * n * Math.sqrt(1 + 0.00025 * n * n);
    const g = a.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(amp * 0.01, t + Math.max(0.2, len / (0.5 + 0.6 * n)));
    o.connect(g);
    g.connect(lp);
    o.start(t);
    o.stop(t + len + 0.05);
  });
  track(out, t + len);
}

export function playChord(notes: number[], when: number, dur: number, vel = 0.5, strum = 0.012) {
  const v = vel / Math.sqrt(Math.max(1, notes.length / 3));
  notes.forEach((m, i) => piano(m, when + i * strum, dur, v));
}

/** Contrebasse synthétique : pincé chaud, harmoniques audibles sur un haut-parleur de téléphone. */
export function bass(midi: number, when: number, dur: number, vel = 0.8) {
  const a = audio();
  const t = Math.max(when, a.currentTime);
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const out = a.createGain();
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(vel * 0.5, t + 0.008);
  out.gain.exponentialRampToValueAtTime(vel * 0.28, t + 0.12);
  out.gain.setTargetAtTime(0.0001, t + dur, 0.06);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(f * 9, t);
  lp.frequency.exponentialRampToValueAtTime(f * 3, t + 0.25);
  lp.connect(out);
  out.connect(bassBus);
  const o1 = a.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = f;
  const o2 = a.createOscillator();
  o2.type = 'sawtooth';
  o2.frequency.value = f;
  const g2 = a.createGain();
  g2.gain.value = 0.25;
  o1.connect(lp);
  o2.connect(g2);
  g2.connect(lp);
  const end = t + dur + 0.4;
  o1.start(t);
  o2.start(t);
  o1.stop(end);
  o2.stop(end);
  track(out, end);
}

function noiseBuffer(a: AudioContext) {
  if (noise) return noise;
  noise = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

function cymbal(when: number, vel: number, decay: number, hp: number) {
  const a = audio();
  const t = Math.max(when, a.currentTime);
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  const f = a.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = a.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f);
  f.connect(g);
  g.connect(drumBus);
  src.start(t);
  src.stop(t + decay + 0.05);
}
export const ride = (when: number, vel = 0.25) => cymbal(when, vel, 0.45, 6500);
export const hat = (when: number, vel = 0.3) => cymbal(when, vel, 0.06, 8000);

/** Clic de décompte. */
export function click(when: number, accent = false) {
  const a = audio();
  const t = Math.max(when, a.currentTime);
  const o = a.createOscillator();
  o.frequency.value = accent ? 1760 : 1320;
  const g = a.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g);
  g.connect(drumBus);
  o.start(t);
  o.stop(t + 0.06);
}
