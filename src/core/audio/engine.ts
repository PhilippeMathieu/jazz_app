// Moteur audio : piano échantillonné (Salamander Grand Piano, Alexander Holm, CC BY 3.0 : deux couches
// de vélocité mêlées), contrebasse (soundfont Musyng Kite, CC BY-SA 3.0), batterie et percussions
// (Versilian Community Sample Library, CC0), réverbération de salle. Tout est planifié sur l'horloge de l'AudioContext.

type Layer = 'p' | 'f';
/** Piano : une note échantillonnée toutes les tierces mineures, de A1 à C7. */
const PIANO: [string, number][] = [
  ['A1', 33], ['C2', 36], ['Ds2', 39], ['Fs2', 42], ['A2', 45], ['C3', 48], ['Ds3', 51], ['Fs3', 54],
  ['A3', 57], ['C4', 60], ['Ds4', 63], ['Fs4', 66], ['A4', 69], ['C5', 72], ['Ds5', 75], ['Fs5', 78],
  ['A5', 81], ['C6', 84], ['Ds6', 87], ['Fs6', 90], ['A6', 93], ['C7', 96]
];
const BASS: [string, number][] = [
  ['E1', 28], ['G1', 31], ['Bb1', 34], ['Db2', 37], ['E2', 40], ['G2', 43], ['Bb2', 46], ['Db3', 49], ['E3', 52], ['G3', 55]
];
const DRUMS = ['ride', 'bell', 'hatfoot', 'hatc', 'snare', 'snarepp', 'rim', 'kick', 'surdo', 'conga', 'clave', 'cowbell', 'shaker'] as const;
type DrumSample = (typeof DRUMS)[number];

interface Sample {
  buf: AudioBuffer;
  /** Début de l'attaque (s) : on saute le silence de tête (et le délai de l'encodeur MP3). */
  onset: number;
}

let ctx: AudioContext | null = null;
let master: GainNode;
let pianoBus: GainNode;
let bassBus: GainNode;
let drumBus: GainNode;
let reverbIn: GainNode;
const piano_ = new Map<string, Sample>(); // « 60p », « 60f »
const bass_ = new Map<number, Sample>();
const drums_ = new Map<DrumSample, Sample>();
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

/** Réponse impulsionnelle d'une petite salle : premières réflexions puis queue qui s'assombrit. */
function roomImpulse(a: AudioContext, seconds = 1.9): AudioBuffer {
  const rate = a.sampleRate;
  const len = Math.floor(rate * seconds);
  const ir = a.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      // Bruit filtré de plus en plus (les aigus meurent plus vite) et décroissance exponentielle.
      const k = 0.35 + 0.6 * Math.min(1, t / seconds);
      lp = lp * k + (Math.random() * 2 - 1) * (1 - k);
      const pre = t < 0.012 ? 0 : 1;
      d[i] = pre * lp * Math.exp(-t * 3.6) * 1.6;
    }
    // Quelques réflexions précoces, différentes à gauche et à droite.
    const taps = ch ? [0.017, 0.029, 0.041, 0.063] : [0.013, 0.023, 0.037, 0.052];
    taps.forEach((tt, j) => (d[Math.floor(tt * rate)] += (ch ? -1 : 1) * (0.5 - j * 0.09)));
  }
  return ir;
}

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
    wake();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 8;
    comp.ratio.value = 3;
    comp.attack.value = 0.006;
    comp.release.value = 0.2;
    master = ctx.createGain();
    master.gain.value = 0.95;
    master.connect(comp);
    comp.connect(ctx.destination);
    // Réverbération partagée, en départ auxiliaire.
    reverbIn = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = roomImpulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverbIn.connect(conv);
    conv.connect(wet);
    wet.connect(master);
    const bus = (gain: number, send: number) => {
      const g = ctx!.createGain();
      g.gain.value = gain;
      g.connect(master);
      const s = ctx!.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(reverbIn);
      return g;
    };
    pianoBus = bus(1, 0.32);
    bassBus = bus(0.9, 0.08);
    drumBus = bus(0.42, 0.18);
  }
  if (loadState === 'idle' || loadState === 'error') void loadSamples();
  if (ctx.state !== 'running') void ctx.resume();
  return ctx;
}
export const now = () => (ctx ? ctx.currentTime : 0);

/**
 * Téléphones : le son ne démarre (ou ne reprend, après verrouillage ou appel) que dans un geste de
 * l'utilisateur. Chaque toucher relance donc le contexte audio ; le premier joue aussi un son vide,
 * ce qui débloque iOS. Le bouton silencieux est contourné par la session audio « playback ».
 */
let primed = false;
function wake() {
  const nav = navigator as Navigator & { audioSession?: { type: string } };
  try {
    // « playback » (le son passe outre le bouton silencieux), sauf si le micro a demandé « play-and-record » :
    // repasser en lecture seule pendant un exercice au micro couperait l'écoute.
    if (nav.audioSession && nav.audioSession.type === 'auto') nav.audioSession.type = 'playback';
  } catch {
    /* non pris en charge */
  }
  if (!ctx) return;
  if (ctx.state !== 'running') void ctx.resume();
  if (!primed) {
    primed = true;
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
  }
}
if (typeof window !== 'undefined') {
  for (const ev of ['pointerdown', 'touchend', 'keydown'] as const) window.addEventListener(ev, wake, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') void ctx.resume();
  });
}

/** Début réel du son : premier échantillon au-dessus du seuil, moins 1 ms. */
function onsetOf(buf: AudioBuffer): number {
  const d = buf.getChannelData(0);
  const lim = Math.min(d.length, Math.floor(buf.sampleRate * 0.3));
  for (let i = 0; i < lim; i++) if (Math.abs(d[i]) > 0.002) return Math.max(0, i / buf.sampleRate - 0.001);
  return 0;
}

async function fetchSample(url: string): Promise<Sample> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} : ${res.status}`);
  const arr = await res.arrayBuffer();
  const buf = await new Promise<AudioBuffer>((ok, ko) => ctx!.decodeAudioData(arr, ok, ko));
  return { buf, onset: onsetOf(buf) };
}

/** Charge les échantillons manquants (piano d'abord) ; en cas d'échec, on réessaiera au prochain son. */
function loadSamples(): Promise<void> {
  if (loading) return loading;
  setLoad('loading');
  const base = import.meta.env.BASE_URL + 'samples/';
  const pianoJobs = PIANO.flatMap(([name, midi]) =>
    (['p', 'f'] as Layer[])
      .filter((l) => !piano_.has(midi + l))
      .map(async (l) => piano_.set(midi + l, await fetchSample(`${base}piano/${name}-${l}.mp3`)))
  );
  loading = Promise.all(pianoJobs)
    .then(() => setLoad('ready'))
    .catch(() => setLoad('error'))
    .finally(() => {
      loading = null;
    });
  // Basse et batterie en arrière-plan : la synthèse sert de secours en attendant.
  for (const [name, midi] of BASS) if (!bass_.has(midi)) fetchSample(`${base}bass/${name}.mp3`).then((s) => bass_.set(midi, s), () => undefined);
  for (const d of DRUMS) if (!drums_.has(d)) fetchSample(`${base}drums/${d}.mp3`).then((s) => drums_.set(d, s), () => undefined);
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

const nearest = (list: [string, number][], midi: number) => list.reduce((b, [, m]) => (Math.abs(m - midi) < Math.abs(b - midi) ? m : b), list[0][1]);

/** Joue un échantillon transposé, avec enveloppe : tenu `dur` secondes puis relâché. */
function voice(s: Sample, rate: number, t: number, dur: number, level: number, release: number, out: AudioNode, pan = 0) {
  const a = ctx!;
  const src = a.createBufferSource();
  src.buffer = s.buf;
  src.playbackRate.value = rate;
  const g = a.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.setValueAtTime(level, t + dur);
  g.gain.setTargetAtTime(0, t + dur, release);
  src.connect(g);
  if (pan && a.createStereoPanner) {
    const p = a.createStereoPanner();
    p.pan.value = pan;
    g.connect(p);
    p.connect(out);
  } else g.connect(out);
  const end = Math.min(t + (s.buf.duration - s.onset) / rate, t + dur + release * 8);
  src.start(t, s.onset);
  src.stop(end + 0.05);
  track(g, end);
}

/** Note de piano. vel 0..1, dur en secondes (durée tenue avant relâchement). */
export function piano(midi: number, when: number, dur: number, vel = 0.6) {
  const a = audio();
  const t = Math.max(when, a.currentTime);
  const m = nearest(PIANO, midi);
  const p = piano_.get(m + 'p');
  const f = piano_.get(m + 'f');
  if (!p || !f) return synthPiano(midi, t, dur, vel);
  const rate = Math.pow(2, (midi - m) / 12);
  // Deux couches mêlées : jouer fort change le timbre (marteau plus brillant), pas seulement le volume.
  const x = Math.min(1, Math.max(0, (vel - 0.25) / 0.55));
  const level = 0.08 + 0.32 * vel;
  // Graves un peu à gauche, aigus un peu à droite, comme assis au piano.
  const pan = Math.max(-0.35, Math.min(0.35, (midi - 64) / 70));
  const release = midi > 88 ? 0.35 : 0.16;
  if (x < 0.98) voice(p, rate, t, dur, level * (1 - x) * 1.25, release, pianoBus, pan);
  if (x > 0.02) voice(f, rate, t, dur, level * x * 0.7, release, pianoBus, pan);
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

/** Contrebasse échantillonnée (synthèse de secours tant que les échantillons ne sont pas là). */
export function bass(midi: number, when: number, dur: number, vel = 0.8) {
  const a = audio();
  const t = Math.max(when, a.currentTime);
  const m = nearest(BASS, midi);
  const smp = bass_.get(m);
  if (smp) return voice(smp, Math.pow(2, (midi - m) / 12), t, dur * 0.92, vel * 3.8, 0.05, bassBus);
  synthBass(midi, t, dur, vel);
}

/** Contrebasse synthétique : pincé chaud, harmoniques audibles sur un haut-parleur de téléphone. */
function synthBass(midi: number, t: number, dur: number, vel: number) {
  const a = ctx!;
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

/** Percussion accordée (grosse caisse, surdo, conga, cloche, clave) : sinus qui chute vers sa hauteur. */
function tone(when: number, vel: number, f0: number, f1: number, decay: number, type: OscillatorType = 'sine') {
  const a = audio();
  const t = Math.max(when, a.currentTime);
  const o = a.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + Math.min(0.08, decay / 2));
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g);
  g.connect(drumBus);
  o.start(t);
  o.stop(t + decay + 0.05);
}
/** Bruit filtré en bande (caisse claire, rim, shaker, balais). */
function band(when: number, vel: number, freq: number, q: number, decay: number) {
  const a = audio();
  const t = Math.max(when, a.currentTime);
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  f.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(vel, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f);
  f.connect(g);
  g.connect(drumBus);
  src.start(t);
  src.stop(t + decay + 0.05);
}

export type DrumSound = 'ride' | 'bell' | 'pedal' | 'hat' | 'kick' | 'snare' | 'rim' | 'brush' | 'shaker' | 'clave' | 'cowbell' | 'surdo' | 'conga';

/** Échantillon et gain de chaque son de batterie ; variation légère de hauteur pour éviter l'effet « mitraillette ». */
const DRUM_MAP: Partial<Record<DrumSound, [DrumSample, number, number]>> = {
  ride: ['ride', 2.4, 0.03],
  bell: ['bell', 1.4, 0.01],
  pedal: ['hatfoot', 1.7, 0.02],
  hat: ['hatc', 1.6, 0.03],
  kick: ['kick', 2.0, 0.02],
  snare: ['snare', 1.5, 0.03],
  rim: ['rim', 1.8, 0.02],
  shaker: ['shaker', 1.5, 0.05],
  clave: ['clave', 1.4, 0.01],
  cowbell: ['cowbell', 1.1, 0.005],
  surdo: ['surdo', 1.6, 0.01],
  conga: ['conga', 1.7, 0.02]
};

/** Une frappe de batterie ou de percussion. */
export function drum(sound: DrumSound, when: number, vel = 0.3) {
  const a = audio();
  const t = Math.max(when, a.currentTime);
  const map = DRUM_MAP[sound];
  const smp = map && drums_.get(map[0]);
  if (map && smp) {
    const rate = 1 + (Math.random() * 2 - 1) * map[2];
    return voice(smp, rate, t, smp.buf.duration, vel * map[1], 0.05, drumBus);
  }
  switch (sound) {
    case 'ride':
    case 'bell':
      return ride(t, vel);
    case 'hat':
    case 'pedal':
      return hat(t, vel);
    case 'kick':
      return tone(t, vel * 1.6, 140, 48, 0.28);
    case 'snare':
      band(t, vel * 1.4, 1800, 0.7, 0.16);
      return tone(t, vel * 0.6, 260, 180, 0.08, 'triangle');
    case 'rim':
      return band(t, vel * 1.5, 2600, 6, 0.045);
    case 'brush':
      return brush(t, vel);
    case 'shaker':
      return band(t, vel, 7000, 1.2, 0.05);
    case 'clave':
      return tone(t, vel * 1.2, 2500, 2400, 0.07);
    case 'cowbell':
      tone(t, vel * 0.7, 800, 790, 0.18, 'square');
      return tone(t, vel * 0.5, 540, 535, 0.18, 'square');
    case 'surdo':
      return tone(t, vel * 1.8, 110, 62, 0.5);
    case 'conga':
      return tone(t, vel * 1.3, 330, 220, 0.18);
  }
}

/** Balais : un « chhh » qui monte puis retombe (bruit filtré), plutôt qu'une frappe. */
function brush(t: number, vel: number) {
  const a = ctx!;
  const src = a.createBufferSource();
  src.buffer = noiseBuffer(a);
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(2600, t);
  f.frequency.linearRampToValueAtTime(4200, t + 0.18);
  f.Q.value = 0.5;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel * 0.9, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  src.connect(f);
  f.connect(g);
  g.connect(drumBus);
  src.start(t);
  src.stop(t + 0.32);
}

/** Clic de décompte : un coup de bois (clave), plus aigu sur le 1. */
export function click(when: number, accent = false) {
  const a = audio();
  const t = Math.max(when, a.currentTime);
  const smp = drums_.get('clave');
  if (smp) return voice(smp, accent ? 1.25 : 1, t, smp.buf.duration, accent ? 0.75 : 0.5, 0.05, drumBus);
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
