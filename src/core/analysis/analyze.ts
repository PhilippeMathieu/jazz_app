// Moteur d'analyse harmonique.
// 1. Regroupe les accords identiques consécutifs.
// 2. Repère les résolutions (V→I, sub tritonique) et les crochets ii–V.
// 3. Choisit un centre tonal par accord (Viterbi sur 24 tonalités : coût d'appartenance
//    + bonus de résolution sur la tonique − pénalité de changement de tonalité).
// 4. Chiffre en degrés (style Berklee : IIm7 – V7 – IΔ7, V7/II, SubV7) et explique.

import { Chart, Key, Mode, flatten, keyOnPc, keyLabel } from '../chart/model';
import { Chord, QUALITIES, chordOnPc, chordSymbol, rootPc } from '../theory/chords';
import { NATURAL_PC, mod, noteName, pcOf, signedPc, spellWith } from '../theory/notes';

type Fn = 'maj' | 'min' | 'dom' | 'hdim' | 'dim';

export type Resolution = 'V' | 'sub';
export interface ChordAnalysis {
  index: number;
  key: Key;
  roman: string;
  explain: string;
  diatonic: boolean;
  resolvesTo?: number;
  resolution?: Resolution;
  /** Rôle dans un ii–V : « ii » ou « V ». */
  iiV?: 'ii' | 'V';
}
export interface Bracket {
  from: number;
  to: number;
  kind: 'iiV' | 'iiSubV';
  /** Indice de l'accord d'arrivée, si la cadence résout. */
  target?: number;
}
export interface KeyRegion {
  from: number;
  to: number;
  key: Key;
}
export interface Analysis {
  chords: ChordAnalysis[];
  brackets: Bracket[];
  regions: KeyRegion[];
}

const fnOf = (c: Chord): Fn => {
  const f = QUALITIES[c.quality].family;
  return f === 'aug' ? 'dom' : f === 'hdim' ? 'hdim' : f;
};
/** Mineur « de type ii » (m7, m9, m11, triade mineure). */
const isMinorSeventhLike = (c: Chord) => ['m7', 'm9', 'm11', 'min'].includes(c.quality);

// Coût d'appartenance d'un accord à une tonalité, par degré (demi-tons depuis la tonique).
type CostTable = Record<number, Partial<Record<Fn, number>>>;
const MAJOR: CostTable = {
  0: { maj: 0, dom: 0.5, min: 2.5 },
  1: { dom: 1.2, dim: 0.5 },
  2: { min: 0, hdim: 1, dom: 1 },
  3: { maj: 1.5, dom: 1.2, dim: 0.5 },
  4: { min: 0, dom: 1 },
  5: { maj: 0, min: 1, dom: 0.5 },
  6: { dim: 0.5, hdim: 1 },
  7: { dom: 0, maj: 0.3, min: 1.5 },
  8: { maj: 1, dom: 1 },
  9: { min: 0, dom: 1 },
  10: { dom: 1, maj: 1.2 },
  11: { hdim: 0, dom: 1, dim: 0.5 }
};
const MINOR: CostTable = {
  0: { min: 0, maj: 2, dom: 1.5 },
  1: { maj: 1.5, dom: 1.2 },
  2: { hdim: 0, min: 0.5, dom: 1 },
  3: { maj: 0, dom: 1.2 },
  5: { min: 0, dom: 0.5, maj: 1 },
  7: { dom: 0, min: 0.8 },
  8: { maj: 0, dom: 1 },
  9: { hdim: 0.5 },
  10: { dom: 0.3, maj: 0.5 },
  11: { dim: 0 }
};
function fitCost(c: Chord, tonic: number, mode: Mode, blues = false): number {
  const d = mod(rootPc(c) - tonic, 12);
  const fn = fnOf(c);
  // Dans un blues, I7 et IV7 sont la norme.
  if (blues && mode === 'major' && fn === 'dom' && (d === 0 || d === 5)) return 0;
  const v = (mode === 'major' ? MAJOR : MINOR)[d]?.[fn];
  if (v !== undefined) return v;
  if (fn === 'dom') return 1.5;
  if (fn === 'dim') return 0.6;
  return 3;
}

const KEY_CHANGE = 2.5;
/** Passer au relatif (B♭ ↔ Gm) est moins coûteux : même armure. */
const RELATIVE_CHANGE = 1.25;
const isRelative = (a: { pc: number; mode: Mode }, b: { pc: number; mode: Mode }) =>
  a.mode !== b.mode && mod(a.mode === 'major' ? a.pc + 9 : a.pc + 3, 12) === b.pc;
const ROMANS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

function romanSuffix(c: Chord): string {
  const id = c.quality;
  const map: Record<string, string> = {
    maj: '', maj7: 'Δ7', '6': '6', '69': '6/9', maj9: 'Δ9', 'maj7#11': 'Δ7♯11',
    min: 'm', m7: 'm7', m6: 'm6', m9: 'm9', m11: 'm11', mM7: 'mΔ7',
    m7b5: 'ø7', dim7: '°7', dim: '°', aug: '+', sus4: 'sus4'
  };
  return map[id] ?? QUALITIES[id].sym;
}

/** Degré en chiffres romains, avec altération lue sur l'orthographe (♭II, ♯IV…). */
function romanNumeral(rootLetter: number, rootPcv: number, key: Key): string {
  const deg = mod(rootLetter - key.tonic.letter, 7);
  const acc = signedPc(rootPcv - (pcOf(key.tonic) + NATURAL_PC[deg]));
  const prefix = acc < 0 ? '♭'.repeat(-acc) : '♯'.repeat(acc);
  return prefix + ROMANS[deg];
}
const romanOf = (c: Chord, key: Key) => romanNumeral(c.root.letter, rootPc(c), key) + romanSuffix(c);

interface Unit {
  chord: Chord;
  idx: number[]; // indices d'origine
}

export function analyze(chart: Chart): Analysis {
  const flat = flatten(chart);
  // 1. Regroupement
  const units: Unit[] = [];
  flat.forEach((f) => {
    const last = units[units.length - 1];
    if (last && rootPc(last.chord) === rootPc(f.chord) && last.chord.quality === f.chord.quality) last.idx.push(f.index);
    else units.push({ chord: f.chord, idx: [f.index] });
  });
  const n = units.length;
  const next = (i: number) => (i + 1) % n; // la grille boucle
  const rp = (i: number) => rootPc(units[i].chord);
  const fn = (i: number) => fnOf(units[i].chord);

  // 2. Résolutions et ii–V
  const res: (Resolution | undefined)[] = units.map((u, i) => {
    if (fn(i) !== 'dom' || n < 2) return undefined;
    const t = next(i);
    if (QUALITIES[units[t].chord.quality].family === 'dom' && units[t].chord.quality === u.chord.quality && rp(t) === rp(i)) return undefined;
    if (mod(rp(t) - rp(i), 12) === 5) return 'V';
    if (mod(rp(t) - rp(i), 12) === 11) return 'sub';
    return undefined;
  });
  const unitBrackets: { ii: number; v: number; kind: 'iiV' | 'iiSubV' }[] = [];
  for (let i = 0; i < n; i++) {
    const v = next(i);
    if (v === i) continue;
    const isII = isMinorSeventhLike(units[i].chord) || fn(i) === 'hdim';
    if (!isII || fn(v) !== 'dom') continue;
    const d = mod(rp(v) - rp(i), 12);
    if (d === 5) unitBrackets.push({ ii: i, v, kind: 'iiV' });
    else if (d === 11) unitBrackets.push({ ii: i, v, kind: 'iiSubV' });
  }
  const hasIIbefore = (v: number) => unitBrackets.some((b) => b.v === v);

  // 3. Viterbi sur les centres tonaux
  const states: { pc: number; mode: Mode }[] = [];
  for (let pc = 0; pc < 12; pc++) states.push({ pc, mode: 'major' }, { pc, mode: 'minor' });
  const chartPc = pcOf(chart.key.tonic);
  const blues = chart.style === 'blues';
  const home = { pc: chartPc, mode: chart.key.mode };
  const sameState = (a: { pc: number; mode: Mode }, b: { pc: number; mode: Mode }) => a.pc === b.pc && a.mode === b.mode;
  // Préférence pour la tonalité de la grille : il faut des indices pour en sortir.
  const prior = (s: { pc: number; mode: Mode }) => (sameState(s, home) ? 0 : isRelative(s, home) ? 0.05 : 0.15);
  const local = (i: number, s: { pc: number; mode: Mode }) => {
    let c = fitCost(units[i].chord, s.pc, s.mode, blues) + prior(s);
    const f = fn(i);
    const isTonic = rp(i) === s.pc && ((s.mode === 'major' && f === 'maj') || (s.mode === 'minor' && f === 'min'));
    if (isTonic) {
      const p = i - 1; // pas de bouclage pour le choix des tonalités
      let bonus = 0;
      if (p >= 0 && res[p] === 'V') bonus = 2;
      else if (p >= 0 && res[p] === 'sub') bonus = 1.5;
      if (bonus && hasIIbefore(p)) bonus += 1;
      // Un m7 suivi d'une dominante à la quarte joue le rôle de ii, pas de tonique.
      if (s.mode === 'minor' && i + 1 < n && fn(i + 1) === 'dom' && mod(rp(i + 1) - rp(i), 12) === 5) bonus *= 0.25;
      if (i === 0 || i === n - 1) bonus += 0.5;
      c -= bonus;
    }
    return c;
  };
  let cost = states.map((s) => (sameState(s, home) ? 0 : isRelative(s, home) ? 0.5 : 1) + local(0, s));
  const back: number[][] = [];
  for (let i = 1; i < n; i++) {
    const nc: number[] = [];
    const bp: number[] = [];
    states.forEach((s, si) => {
      let best = Infinity;
      let arg = 0;
      cost.forEach((pcost, pj) => {
        const v = pcost + (pj === si ? 0 : isRelative(states[pj], s) ? RELATIVE_CHANGE : KEY_CHANGE);
        if (v < best - 1e-9) {
          best = v;
          arg = pj;
        }
      });
      nc.push(best + local(i, s));
      bp.push(arg);
    });
    back.push(bp);
    cost = nc;
  }
  let sIdx = cost.indexOf(Math.min(...cost));
  const keyIdx: number[] = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    keyIdx[i] = sIdx;
    if (i > 0) sIdx = back[i - 1][sIdx];
  }
  // Changement de tonalité au plus tard : un accord qui appartient aussi bien à l'ancienne
  // tonalité reste dans l'ancienne (E♭maj7 reste le IV de B♭ avant le ii–V vers Gm).
  for (let i = 1; i < n; i++) {
    if (keyIdx[i] === keyIdx[i - 1]) continue;
    const from = keyIdx[i - 1];
    const to = keyIdx[i];
    let j = i;
    while (j < n && keyIdx[j] === to) {
      const u = units[j].chord;
      const isTonicOfNew = rp(j) === states[to].pc;
      const inBracket = unitBrackets.some((b) => b.ii === j || b.v === j);
      if (isTonicOfNew || inBracket) break;
      if (fitCost(u, states[from].pc, states[from].mode, blues) > fitCost(u, states[to].pc, states[to].mode, blues)) break;
      keyIdx[j] = from;
      j++;
    }
    i = j;
  }
  // Un ii–V qui résout appartient à la tonalité de sa cible.
  for (const b of unitBrackets) {
    const t = next(b.v);
    if (res[b.v] && t > b.v && b.v > b.ii) {
      const ts = keyIdx[t];
      if (states[ts].pc === rp(t)) keyIdx[b.ii] = keyIdx[b.v] = ts;
    }
  }
  for (let i = 0; i < n; i++) {
    if (res[i] && next(i) > i && states[keyIdx[next(i)]].pc === rp(next(i)) && fitCost(units[i].chord, states[keyIdx[next(i)]].pc, states[keyIdx[next(i)]].mode) <= fitCost(units[i].chord, states[keyIdx[i]].pc, states[keyIdx[i]].mode)) keyIdx[i] = keyIdx[next(i)];
  }

  // Orthographe des tonalités : celle de la tonique si elle apparaît, sinon l'usuelle.
  const keyFor = (si: number): Key => {
    const s = states[si];
    const hit = units.find((u) => rootPc(u.chord) === s.pc);
    if (pcOf(chart.key.tonic) === s.pc) return { tonic: chart.key.tonic, mode: s.mode };
    if (hit) return { tonic: hit.chord.root, mode: s.mode };
    return keyOnPc(s.pc, s.mode);
  };
  const unitKeys = keyIdx.map(keyFor);

  // 4. Chiffrage et explications
  const out: ChordAnalysis[] = new Array(flat.length);
  units.forEach((u, i) => {
    const key = unitKeys[i];
    const s = states[keyIdx[i]];
    const c = u.chord;
    const diatonic = fitCost(c, s.pc, s.mode, blues) === 0;
    const t = next(i);
    const tSym = chordSymbol(units[t].chord);
    const r = res[i];
    const asII = unitBrackets.find((b) => b.ii === i);
    const asV = unitBrackets.find((b) => b.v === i);
    const deg = mod(rp(i) - s.pc, 12);
    const f = fn(i);
    let roman = romanOf(c, key);
    let explain: string;
    const kName = keyLabel(key);

    const bluesColor = blues && s.mode === 'major' && f === 'dom' && (deg === 0 || deg === 5) && !asV;
    const pv = (i - 1 + n) % n;
    if (f === 'dom' && r && !bluesColor) {
      const targetIsTonic = rp(t) === s.pc;
      const targetRoman = romanNumeral(units[t].chord.root.letter, rp(t), key);
      if (r === 'V') {
        if (targetIsTonic) {
          roman = 'V' + romanSuffix(c);
          explain = `Dominante de ${kName} : résout une quarte plus haut sur ${tSym}.`;
        } else {
          roman = 'V' + romanSuffix(c) + '/' + targetRoman;
          explain = `Dominante secondaire : V7 de ${tSym}, sur lequel elle résout.`;
        }
      } else {
        const eq = chordSymbol(chordOnPc(mod(rp(i) + 6, 12), '7'));
        roman = 'SubV' + romanSuffix(c) + (targetIsTonic ? '' : '/' + targetRoman);
        explain = `Substitution tritonique : remplace ${eq} (même triton) et descend d'un demi-ton sur ${tSym}.`;
      }
    } else if (f === 'dom' && s.mode === 'major' && deg === 10 && (rp(t) === s.pc || (mod(rp(t) - s.pc, 12) === 4 && fn(t) === 'min'))) {
      explain = `Dominante « backdoor » (♭VII7) : emprunt au mineur, arrive sur ${tSym} sans passer par le V7.`;
    } else if (asII) {
      const v = units[asII.v].chord;
      const targetPc = mod(rp(asII.v) + (asII.kind === 'iiV' ? 5 : 11), 12);
      const label = f === 'hdim' ? 'IIø7' : 'IIm7';
      if (targetPc === s.pc) {
        explain = `${label} du ii–V de ${kName} : prépare ${chordSymbol(v)}.`;
      } else {
        const tgt = spellWith(v.root.letter + (asII.kind === 'iiV' ? 3 : 0), targetPc);
        explain = `${roman} en ${kName}, mais ici il sert de II dans un ii–V vers ${noteName(tgt)} : prépare ${chordSymbol(v)}.`;
      }
    } else if (deg === 0 && (f === 'maj' || f === 'min')) {
      explain = `Tonique de ${kName}.`;
    } else if (f === 'dim' && mod(rp(i) - rp(pv), 12) === 1) {
      explain = `Diminué de passage : la basse monte d'un demi-ton depuis ${chordSymbol(units[pv].chord)}, puis l'harmonie revient vers ${tSym}.`;
    } else if (f === 'dim' && mod(rp(t) - rp(i), 12) === 1) {
      explain = `Diminué de passage : la basse monte d'un demi-ton vers ${tSym}.`;
    } else if (f === 'dim' && mod(rp(t) - rp(i), 12) === 11) {
      explain = `Diminué de passage : la basse descend d'un demi-ton vers ${tSym}.`;
    } else if (f === 'dom' && s.mode === 'major' && deg === 0) {
      explain = `Couleur blues : la tonique jouée en accord de 7.`;
    } else if (f === 'dom' && s.mode === 'major' && deg === 5) {
      explain = `Couleur blues : le IV joué en accord de 7.`;
    } else if (f === 'dom' && deg === 7) {
      explain = `Dominante de ${kName}, mais elle ne résout pas ici : la grille enchaîne sur ${tSym}.`;
    } else if (s.mode === 'major' && f === 'min' && deg === 5) {
      explain = `Sous-dominante mineure : emprunt au mode mineur de ${noteName(key.tonic)}.`;
    } else if (diatonic) {
      explain = `Accord diatonique de ${kName}.`;
    } else {
      explain = `Accord hors tonalité (${roman} en ${kName}).`;
    }

    u.idx.forEach((ix, k) => {
      const last = k === u.idx.length - 1;
      out[ix] = {
        index: ix,
        key,
        roman,
        explain,
        diatonic,
        resolution: last ? r : undefined,
        resolvesTo: last && r ? units[t].idx[0] : undefined,
        iiV: asII ? 'ii' : asV ? 'V' : undefined
      };
    });
  });

  const brackets: Bracket[] = unitBrackets.map((b) => ({
    from: units[b.ii].idx[0],
    to: units[b.v].idx[units[b.v].idx.length - 1],
    kind: b.kind,
    target: res[b.v] ? units[next(b.v)].idx[0] : undefined
  }));

  const regions: KeyRegion[] = [];
  out.forEach((a, i) => {
    const last = regions[regions.length - 1];
    if (last && pcOf(last.key.tonic) === pcOf(a.key.tonic) && last.key.mode === a.key.mode) last.to = i;
    else regions.push({ from: i, to: i, key: a.key });
  });

  return { chords: out, brackets, regions };
}
