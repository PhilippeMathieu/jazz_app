// Impro guidée : une boucle d'accords, une poignée de notes permises, une consigne par passage.
// D'après Aebersold (Vol. 1) : improviser tout de suite, sur peu de notes, avec des silences ; un rythme imposé
// quand on se perd ; puis une note de l'accord sur les temps forts. Sans interface, testable.
import { Chord, chordPcs, parseChord } from '../../core/theory/chords';
import { mod } from '../../core/theory/notes';
import type { Feel } from '../../core/rhythm/patterns';
import { scoreTiming } from '../../core/rhythm/timing';

export interface ImproNeed {
  /** Notes jouées, au moins. */
  notes: number;
  /** Part des notes dans la gamme (%). */
  inScale: number;
  /** Respirations : au moins 2 temps sans nouvelle note. */
  breaths?: number;
  /** Mesures de silence respectées (%). */
  rests?: number;
  /** Attaques du rythme imposé jouées à temps (%). */
  rhythm?: number;
  /** Mesures avec une note de l'accord sur le 1er temps (%). */
  targets?: number;
}

export interface ImproLevel {
  id: string;
  /** Ce qu'on joue, en quelques mots. */
  name: string;
  /** Les notes permises, en mots. */
  notesText: string;
  /** Les notes permises, nommées (pour le clavier). */
  names: string[];
  /** Les accords de la boucle, une mesure chacun, répétés pour remplir le passage. */
  loop: string[];
  feel: Feel;
  tempo: number;
  /** Mesures d'un passage. */
  bars: number;
  /** Mesures (à partir de 0) où l'on se tait. */
  rests?: number[];
  /** Rythme imposé : attaques en croches sur 2 mesures (0 à 15), répété. */
  rhythm?: number[];
  /** Une note de l'accord sur le 1er temps de chaque mesure. */
  target?: boolean;
  /** Ou seulement sur ces mesures (à partir de 0) : les mesures-pivots, où l'on entend si l'on suit la grille. */
  targetBars?: number[];
  /** Consignes, une par passage (la dernière revient ensuite). */
  tips: string[];
  need: ImproNeed;
}

const PC: Record<string, number> = { C: 0, 'C♯': 1, 'D♭': 1, D: 2, 'D♯': 3, 'E♭': 3, E: 4, F: 5, 'F♯': 6, 'G♭': 6, G: 7, 'G♯': 8, 'A♭': 8, A: 9, 'A♯': 10, 'B♭': 10, B: 11 };

export const IMPRO: Record<string, ImproLevel> = {
  noires: {
    id: 'noires',
    name: 'Les touches noires',
    notesText: 'Les 5 touches noires : aucune ne sonne faux sur cette boucle.',
    names: ['G♭', 'A♭', 'B♭', 'D♭', 'E♭'],
    loop: ['G♭', 'E♭m', 'A♭m', 'D♭'],
    feel: 'straight',
    tempo: 80,
    bars: 8,
    tips: [
      'Des notes longues, une ou deux par mesure. Écoute comment chacune sonne sur la boucle.',
      'Une petite idée de 3 notes, puis rejoue-la plus haut ou plus bas.',
      'Une phrase, un silence, une autre phrase : comme quand tu parles.'
    ],
    need: { notes: 8, inScale: 85, breaths: 2 }
  },
  cinq: {
    id: 'cinq',
    name: 'Phrases et silences',
    notesText: 'C D E F G : la main posée, un doigt par note.',
    names: ['C', 'D', 'E', 'F', 'G'],
    loop: ['C', 'F', 'G', 'C'],
    feel: 'straight',
    tempo: 84,
    bars: 8,
    rests: [2, 3, 6, 7],
    tips: [
      'Mesures 1–2 : joue. Mesures 3–4 : silence, écoute la boucle. Puis pareil.',
      'Ta 2e phrase répond à la 1re : même début, autre fin.',
      'Finis la 1re phrase sur G (elle reste en l’air), la 2e sur C (elle se pose).'
    ],
    need: { notes: 8, inScale: 90, rests: 75 }
  },
  'penta-c': {
    id: 'penta-c',
    name: 'La pentatonique de C',
    notesText: 'C D E G A : la gamme de C sans F ni B, les deux notes qui frottent.',
    names: ['C', 'D', 'E', 'G', 'A'],
    loop: ['C', 'Am', 'F', 'G'],
    feel: 'straight',
    tempo: 88,
    bars: 8,
    tips: [
      'Commence et finis sur C.',
      'Rejoue la même idée sur deux accords différents : elle change de couleur.',
      'Monte haut, descends bas : prends tout le clavier.'
    ],
    need: { notes: 10, inScale: 85, breaths: 2 }
  },
  'penta-pop': {
    id: 'penta-pop',
    name: 'Sur la suite de la pop',
    notesText: 'La pentatonique de C. Sur chaque 1er temps, une note de l’accord (en bleu).',
    names: ['C', 'D', 'E', 'G', 'A'],
    loop: ['C', 'G', 'Am', 'F'],
    feel: 'straight',
    tempo: 88,
    bars: 8,
    target: true,
    tips: [
      'Sur chaque 1er temps, une note de l’accord : les touches bleues changent avec lui.',
      'Une note longue sur le 1er temps, des notes plus rapides entre deux.',
      'Deux mesures qui bougent, deux mesures calmes.'
    ],
    need: { notes: 12, inScale: 85, targets: 50, breaths: 2 }
  },
  dorien: {
    id: 'dorien',
    name: 'Un seul accord : Dm7',
    notesText: 'Les touches blanches : la gamme de C, jouée sur Dm7.',
    names: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    loop: ['Dm7'],
    feel: 'swing',
    tempo: 112,
    bars: 8,
    rhythm: [0, 3, 6, 8],
    tips: [
      'Le rythme est imposé (ci-dessous) : tu ne choisis que les notes.',
      'Même rythme, autres notes : monte sur une phrase, descends sur la suivante.',
      'Commence chaque phrase sur D, F ou A : les notes de Dm.'
    ],
    need: { notes: 12, inScale: 85, rhythm: 60 }
  },
  blues: {
    id: 'blues',
    name: 'La gamme blues',
    notesText: 'F A♭ B♭ B C E♭ : la gamme blues de F, sur tout le blues.',
    names: ['F', 'A♭', 'B♭', 'B', 'C', 'E♭'],
    loop: ['F7', 'F7', 'F7', 'F7', 'B♭7', 'B♭7', 'F7', 'F7', 'C7', 'B♭7', 'F7', 'C7'],
    feel: 'swing',
    tempo: 100,
    bars: 12,
    targetBars: [4, 8],
    tips: [
      'D’abord 3 notes : F, A♭, B♭. Puis ajoute les autres.',
      'Mesures 5 et 9 : une note bleue sur le 1er temps. C’est là qu’on entend si tu suis la grille.',
      'Le B ne se tient pas : il glisse vers B♭ ou vers C.',
      'Une phrase de 2 mesures sur F7, la même sur B♭7 : c’est ça, le blues.'
    ],
    need: { notes: 16, inScale: 85, breaths: 3, targets: 50 }
  },
  cibles: {
    id: 'cibles',
    name: 'Les notes de l’accord sur le 1er temps',
    notesText: 'La gamme de C. Sur chaque 1er temps, une note de l’accord (en bleu) : 1, 3, 5 ou 7.',
    names: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    loop: ['Dm7', 'G7', 'Cmaj7', 'Cmaj7'],
    feel: 'swing',
    tempo: 108,
    bars: 8,
    target: true,
    tips: [
      'Sur chaque 1er temps, une note bleue ; entre deux, ce que tu veux dans la gamme.',
      'Vise la 3ce : F sur Dm7, B sur G7, E sur Cmaj7.',
      'Entre deux cibles, des croches longue-courte, comme la batterie.'
    ],
    need: { notes: 16, inScale: 85, targets: 60 }
  }
};

export const scaleOf = (l: ImproLevel) => l.names.map((n) => PC[n]);

/** Mesures où l'on vise une note de l'accord sur le 1er temps (aucune si le niveau n'a pas de cibles). */
export const targetBarsOf = (l: ImproLevel): number[] =>
  l.targetBars ?? (l.target ? Array.from({ length: l.bars }, (_, b) => b).filter((b) => !l.rests?.includes(b)) : []);

/** Les accords du passage, mesure par mesure. */
export function barsOf(l: ImproLevel): Chord[] {
  const loop = l.loop.map((s) => parseChord(s)!);
  return Array.from({ length: l.bars }, (_, b) => loop[b % loop.length]);
}

/** Consigne du passage n (0…). */
export const tipOf = (l: ImproLevel, n: number) => l.tips[Math.min(n, l.tips.length - 1)];

/** Instant (en temps) d'une croche (0…), avec le swing. */
export const eighthBeat = (e: number, swing: number) => Math.floor(e / 2) + (e % 2 ? swing : 0);

/** Attaques du rythme imposé sur le passage, en temps depuis le début. */
export function rhythmBeats(l: ImproLevel, swing: number): number[] {
  if (!l.rhythm) return [];
  const out: number[] = [];
  for (let two = 0; two * 2 < l.bars; two++) for (const e of l.rhythm) if (two * 2 + Math.floor(e / 8) < l.bars) out.push(two * 8 + eighthBeat(e, swing));
  return out;
}

export interface TakeNote {
  /** Secondes depuis le 1er temps du passage (latence déjà retranchée). */
  t: number;
  midi: number;
}

export interface TakeResult {
  notes: number;
  inScale: number;
  breaths: number;
  rests?: number;
  rhythm?: number;
  targets?: number;
  ok: boolean;
  /** Ce qui manque, en mots (vide si réussi). */
  fix: string[];
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/**
 * Bilan d'un passage. notes : les notes entendues ; onsets : les attaques (s depuis le 1er temps), pour le rythme
 * imposé ; spb : secondes par temps ; swing : place de la croche du « et » (0,5 droit, ~0,6 swing).
 */
export function scoreTake(l: ImproLevel, notes: TakeNote[], onsets: number[], spb: number, swing = 0.5, tolMs = 90): TakeResult {
  const bar = 4 * spb;
  const end = l.bars * bar;
  const ns = notes.filter((n) => n.t >= -0.3 * spb && n.t < end + 0.3 * spb).sort((a, b) => a.t - b.t);
  const scale = scaleOf(l);
  const inScale = pct(ns.filter((n) => scale.includes(mod(n.midi, 12))).length, ns.length);
  // Respirations : 2 temps ou plus sans nouvelle note (silence, ou note tenue : de l'espace dans les deux cas).
  let breaths = 0;
  for (let i = 1; i < ns.length; i++) if (ns[i].t - ns[i - 1].t >= 2 * spb - 0.05) breaths++;
  if (ns.length && end - ns[ns.length - 1].t >= 2 * spb) breaths++;
  const r: TakeResult = { notes: ns.length, inScale, breaths, ok: true, fix: [] };
  const need = l.need;

  if (l.rests?.length) {
    const kept = l.rests.filter((b) => !ns.some((n) => n.t >= b * bar + 0.25 * spb && n.t < (b + 1) * bar - 0.25 * spb)).length;
    r.rests = pct(kept, l.rests.length);
  }
  if (l.rhythm) {
    const targets = rhythmBeats(l, swing).map((b) => b * spb);
    r.rhythm = pct(scoreTiming(targets, onsets, tolMs, 0, 0.25).good, targets.length);
  }
  if (l.target || l.targetBars) {
    const chords = barsOf(l);
    const bars = targetBarsOf(l);
    const hit = bars.filter((b) => {
      const pcs = chordPcs(chords[b]);
      return ns.some((n) => n.t >= b * bar - 0.35 * spb && n.t < b * bar + 0.6 * spb && pcs.includes(mod(n.midi, 12)));
    }).length;
    r.targets = pct(hit, bars.length);
  }

  const out = ns.length - ns.filter((n) => scale.includes(mod(n.midi, 12))).length;
  if (ns.length < need.notes) r.fix.push(`Joue un peu plus : au moins ${need.notes} notes (${ns.length} entendue${ns.length > 1 ? 's' : ''}).`);
  if (ns.length && inScale < need.inScale) r.fix.push(`${out} note${out > 1 ? 's' : ''} hors des notes permises : reste sur ${l.names.join(' ')}.`);
  if (need.breaths !== undefined && breaths < need.breaths) r.fix.push('Laisse des silences : arrête-toi au moins 2 temps entre deux phrases.');
  if (need.rests !== undefined && (r.rests ?? 0) < need.rests) r.fix.push(`Tais-toi pendant les mesures ${(l.rests ?? []).map((b) => b + 1).join(', ')} : écoute la boucle.`);
  if (need.rhythm !== undefined && (r.rhythm ?? 0) < need.rhythm) r.fix.push(`Suis le rythme imposé : ${r.rhythm ?? 0} % des attaques à temps (il en faut ${need.rhythm} %).`);
  if (need.targets !== undefined && (r.targets ?? 0) < need.targets) r.fix.push(`Sur le 1er temps, vise une touche bleue : ${r.targets ?? 0} % des mesures (il en faut ${need.targets} %).`);
  r.ok = r.fix.length === 0;
  return r;
}

export interface ExNote {
  /** En temps depuis le 1er temps du passage. */
  beat: number;
  /** Durée, en temps. */
  dur: number;
  midi: number;
}

/** Rythmes de 2 mesures pour l'exemple, en croches (0 à 15) : une phrase, puis de l'espace. */
const EX_RHYTHMS = [
  [0, 2, 4, 6, 8],
  [0, 3, 4, 6, 8],
  [0, 2, 3, 6, 8, 10],
  [1, 2, 4, 7, 8]
];

/** Une impro d'exemple, jouée par l'appli : ce qu'on attend, à entendre avant d'essayer. */
export function exampleLine(l: ImproLevel, swing: number, rng: () => number = Math.random): ExNote[] {
  const scale = scaleOf(l);
  const pool: number[] = [];
  for (let m = 60; m <= 79; m++) if (scale.includes(mod(m, 12))) pool.push(m);
  const chords = barsOf(l);
  const out: ExNote[] = [];
  let i = Math.floor(pool.length / 3);
  for (let two = 0; two * 2 < l.bars; two++) {
    // Question-réponse : on ne joue que sur les mesures de jeu ; sinon une phrase par paire de mesures.
    const base = l.rhythm ?? EX_RHYTHMS[Math.floor(rng() * EX_RHYTHMS.length)];
    // Avec des cibles : une note sur chaque 1er temps.
    const aimed = targetBarsOf(l);
    const rhythm = aimed.length ? [...new Set([...(aimed.includes(two * 2) ? [0] : []), ...(aimed.includes(two * 2 + 1) ? [8] : []), ...base])].sort((x, y) => x - y) : base;
    const eighths = rhythm.filter((e) => {
      const b = two * 2 + Math.floor(e / 8);
      return b < l.bars && !l.rests?.includes(b);
    });
    eighths.forEach((e, k) => {
      const b = two * 2 + Math.floor(e / 8);
      const beat = two * 8 + eighthBeat(e, swing);
      const next = k + 1 < eighths.length ? two * 8 + eighthBeat(eighths[k + 1], swing) : beat + 2;
      const pcs = chordPcs(chords[b]).filter((p) => scale.includes(p));
      const downbeat = e % 8 === 0;
      const last = k === eighths.length - 1;
      if ((downbeat && aimed.includes(b)) || last) {
        // Sur le 1er temps (ou en fin de phrase) : la note de l'accord la plus proche.
        const cands = pool.map((m, j) => ({ m, j })).filter((x) => pcs.includes(mod(x.m, 12)));
        if (cands.length) i = cands.reduce((a, x) => (Math.abs(x.j - i) < Math.abs(a.j - i) ? x : a)).j;
      } else {
        const step = [-2, -1, -1, 1, 1, 2][Math.floor(rng() * 6)];
        i = Math.max(0, Math.min(pool.length - 1, i + step));
      }
      out.push({ beat, dur: Math.min(2, Math.max(0.4, next - beat - 0.05)), midi: pool[i] });
    });
  }
  return out;
}
