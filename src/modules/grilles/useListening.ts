// Écoute au micro pendant le play-along : accompagnement (mode Degrés) ou main droite (Gammes, Guide tones).
import { useEffect, useRef, useState } from 'preact/hooks';
import { ImprovPlan, NoteClass, classifyNote, isGuideTone } from '../../core/analysis/improv';
import { degreeLabel, spellInChord } from '../../core/theory/chords';
import { micGate, readChord, readMono, useMicLoop, useMicState } from '../../core/listen/mic';
import { NoteTracker } from '../../core/listen/tracker';
import { checkComping } from '../../core/listen/comping';
import { Position } from '../../core/player/player';

export type ListenMode = 'analyse' | 'gammes' | 'guide';
export type HitClass = NoteClass | 'approach';
export interface Hit {
  midi: number;
  cls: HitClass;
  guide: boolean;
  /** Jouée sur le premier temps de l'accord. */
  downbeat: boolean;
}
/** Bilan d'un passage sur un accord (clé « chorus:accord »). */
export interface ChordResult {
  hits: Hit[];
  /** Accompagnement : nombre de mesures d'écoute justes / entendues. */
  compOk: number;
  compHeard: number;
}
export interface LastNote {
  name: string;
  deg: string;
  cls: HitClass;
  guide: boolean;
}

const emptyResult = (): ChordResult => ({ hits: [], compOk: 0, compHeard: 0 });

export function useListening(mode: ListenMode, plan: ImprovPlan, pos: Position | null, beatsPerBar = 4) {
  const mic = useMicState();
  const active = mic === 'on' && !!pos;
  const tracker = useRef(new NoteTracker());
  const hist = useRef<{ t: number; chord: number; chorus: number; beat: number }[]>([]);
  const [results, setResults] = useState<Record<string, ChordResult>>({});
  const [done, setDone] = useState<string[]>([]);
  const [last, setLast] = useState<LastNote | null>(null);
  const playing = !!pos;

  // Nouvelle lecture ou nouveau mode : on repart de zéro.
  useEffect(() => {
    if (!playing) return;
    setResults({});
    setDone([]);
    setLast(null);
    hist.current = [];
    tracker.current = new NoteTracker();
  }, [playing, mode]);

  // Position : un repère par temps ; à chaque changement d'accord, l'accord précédent est « terminé ».
  useEffect(() => {
    if (!pos) return;
    const f = plan.flat[pos.chord];
    const beat = pos.bar * beatsPerBar + pos.beatInBar - (f?.start ?? 0);
    const prev = hist.current[hist.current.length - 1];
    hist.current = [...hist.current.slice(-16), { t: performance.now(), chord: pos.chord, chorus: pos.chorus, beat }];
    if (mic === 'on' && prev && (prev.chord !== pos.chord || prev.chorus !== pos.chorus)) {
      const k = `${prev.chorus}:${prev.chord}`;
      setDone((d) => (d.includes(k) ? d : [...d.slice(-200), k]));
    }
  }, [pos?.chord, pos?.chorus, pos?.beatInBar]);

  const at = (t: number) => {
    const h = hist.current;
    return [...h].reverse().find((x) => x.t <= t) ?? h[h.length - 1];
  };
  const update = (key: string, f: (r: ChordResult) => ChordResult) => setResults((all) => ({ ...all, [key]: f(all[key] ?? emptyResult()) }));

  // Main droite : une note à la fois.
  useMicLoop(active && mode !== 'analyse', () => {
    const m = readMono();
    if (!m) return;
    const ev = tracker.current.push(m.pitch, m.level, performance.now(), micGate());
    if (!ev) return;
    // Confirmée ~0,1 s après l'attaque : on l'attribue à l'accord joué à ce moment-là.
    const h = at(ev.t - 120);
    if (!h) return;
    const c = plan.flat[h.chord].chord;
    const pc = ev.midi % 12;
    const hit: Hit = { midi: ev.midi, cls: classifyNote(pc, c, plan.scales[h.chord].scale), guide: isGuideTone(pc, c), downbeat: h.beat === 0 };
    const key = `${h.chorus}:${h.chord}`;
    update(key, (r) => {
      const hits = [...r.hits];
      // Note chromatique qui se résout d'un demi-ton sur une note de l'accord : une approche, pas une faute.
      const prev = hits[hits.length - 1];
      if (prev && prev.cls === 'out' && Math.abs(prev.midi - hit.midi) === 1 && hit.cls === 'chord') hits[hits.length - 1] = { ...prev, cls: 'approach' };
      return { ...r, hits: [...hits, hit] };
    });
    setLast({ name: spellInChord(c, pc), deg: degreeLabel(c, pc), cls: hit.cls, guide: hit.guide });
  }, 50);

  // Accompagnement : l'accord entier, plusieurs fois par mesure.
  useMicLoop(active && mode === 'analyse', () => {
    const h = hist.current[hist.current.length - 1];
    if (!h || performance.now() - h.t > 2000) return;
    const r = readChord();
    if (!r?.analysis) return;
    const ck = checkComping(r.analysis.chroma, plan.flat[h.chord].chord, plan.scales[h.chord].scale, r.analysis.soft);
    update(`${h.chorus}:${h.chord}`, (x) => ({ ...x, compHeard: x.compHeard + 1, compOk: x.compOk + (ck.ok ? 1 : 0) }));
  }, 150);

  // Bilan
  const finished = done.map((k) => results[k] ?? emptyResult());
  const hits = Object.values(results).flatMap((r) => r.hits);
  const pct = (f: (h: Hit) => boolean) => (hits.length ? Math.round((hits.filter(f).length / hits.length) * 100) : 0);
  const compChords = finished.filter((r) => r.compHeard > 0);
  const summary = {
    notes: hits.length,
    chord: pct((h) => h.cls === 'chord'),
    scale: pct((h) => h.cls === 'scale'),
    approach: pct((h) => h.cls === 'approach'),
    out: pct((h) => h.cls === 'out'),
    targets: finished.filter((r) => r.hits.some((h) => h.downbeat && (mode === 'guide' ? h.guide : h.cls === 'chord'))).length,
    chords: finished.length,
    compOk: compChords.filter((r) => r.compOk >= 2).length,
    compChords: compChords.length
  };

  /** État d'un accord du chorus en cours, pour la grille. */
  const statusOf = (chorus: number, ci: number): { done: boolean; ok: boolean; hits: Hit[] } | null => {
    if (mic !== 'on') return null;
    const k = `${chorus}:${ci}`;
    const r = results[k];
    const isDone = done.includes(k);
    if (!r && !isDone) return null;
    const res = r ?? emptyResult();
    const ok = mode === 'analyse' ? res.compOk >= 2 : res.hits.some((h) => (mode === 'guide' ? h.guide : h.cls === 'chord') && h.downbeat);
    return { done: isDone, ok, hits: res.hits };
  };

  return { listening: mic === 'on', active, last, summary, statusOf };
}
