// « Analyser » : les enchaînements à repérer dans une grille, et la correction de ce que l'élève a marqué.
// Tout part de l'analyse (analyze.ts) : crochets ii–V, résolutions, backdoor ; plus les turnarounds.
import { FlatChord, Key, keyLabel, keyOnPc } from '../chart/model';
import { QUALITIES, chordSymbol, rootPc } from '../theory/chords';
import { mod, noteName, pcOf } from '../theory/notes';
import { Analysis } from './analyze';

export type SpotType = 'iiVI' | 'iiVi' | 'iiV' | 'VI' | 'sec' | 'subV' | 'back' | 'turn';

export const SPOT_LABEL: Record<SpotType, string> = {
  iiVI: 'ii–V–I',
  iiVi: 'ii–V–i mineur',
  iiV: 'ii–V sans résolution',
  VI: 'V–I',
  sec: 'Dominante secondaire',
  subV: 'SubV',
  back: 'Backdoor',
  turn: 'Turnaround'
};
export const SPOT_SUB: Record<SpotType, string> = {
  iiVI: 'IIm7 – V7 – IΔ7',
  iiVi: 'IIø7 – V7 – Im',
  iiV: 'IIm7 – V7, sans le I',
  VI: 'V7 qui résout sur le I',
  sec: 'V7 d’un autre accord que le I',
  subV: '7 qui descend d’un demi-ton',
  back: 'IVm7 – ♭VII7 – I',
  turn: 'I – VI – II – V'
};
export const SPOT_ORDER: SpotType[] = ['iiVI', 'iiVi', 'iiV', 'VI', 'sec', 'subV', 'back', 'turn'];

export interface Spot {
  type: SpotType;
  /** Autres réponses acceptées (ii–V pour un ii–V–I, V–I pour une dominante secondaire…). */
  accept: SpotType[];
  /** Indices (grille à plat) où l'enchaînement peut commencer / finir. */
  starts: number[];
  ends: number[];
  from: number;
  to: number;
  /** Tonalité ou accord visé. */
  target: Key;
  explain: string;
  /** Repère principal (compté dans le score) ; sinon « à voir aussi ». */
  main: boolean;
}

/** Un repérage de l'élève. */
export interface Mark {
  from: number;
  to: number;
  type: SpotType;
  /** Note visée (classe de hauteur). */
  target: number;
}

export interface MarkResult {
  mark: Mark;
  verdict: 'ok' | 'near' | 'bad';
  text: string;
  spot?: Spot;
}

export interface Correction {
  results: MarkResult[];
  missed: Spot[];
  extras: string[];
  found: number;
  total: number;
}

const family = (c: FlatChord) => QUALITIES[c.chord.quality].family;
const isMinorish = (c: FlatChord) => ['min', 'hdim', 'dim'].includes(family(c));

export function findSpots(flat: FlatChord[], an: Analysis, beatsPerBar = 4): Spot[] {
  const n = flat.length;
  if (n < 2) return [];
  // Accords identiques consécutifs : une seule « unité ».
  const unitOf: number[] = [];
  const units: number[][] = [];
  flat.forEach((f, i) => {
    const prev = units[units.length - 1];
    const same = prev && rootPc(flat[prev[0]].chord) === rootPc(f.chord) && flat[prev[0]].chord.quality === f.chord.quality;
    if (same) prev.push(i);
    else units.push([i]);
    unitOf[i] = units.length - 1;
  });
  const U = (i: number) => units[unitOf[i]];
  const sym = (i: number) => chordSymbol(flat[i].chord);
  const bars = (a: number, b: number) => {
    const x = flat[a].bar + 1;
    const y = flat[b].bar + 1;
    return x === y ? `mes. ${x}` : `mes. ${x}–${y}`;
  };
  const keyAt = (i: number): Key => {
    const c = flat[i];
    return keyOnPc(rootPc(c.chord), isMinorish(c) ? 'minor' : 'major');
  };
  const spots: Spot[] = [];
  const inBracket = new Set<number>();
  /** Accord qui suit (sans boucler sur le début de la grille). */
  const after = (i: number) => {
    const u = unitOf[i] + 1;
    return u < units.length ? units[u][0] : undefined;
  };
  /** Cible qui n'est pas la tonique locale : ii–V ou dominante « secondaire ». */
  const via = (t: number) => {
    const a = an.chords[t];
    return pcOf(a.key.tonic) === rootPc(flat[t].chord) ? '' : ` Ici ${sym(t)} n’est pas une tonique : c’est le ${a.roman} de ${keyLabel(a.key)}, mis en valeur par sa propre cadence.`;
  };
  const backdoor = (from: number, v: number, withIV: boolean) => {
    const t = after(v);
    const end = t !== undefined ? U(t) : U(v);
    const k = keyOnPc(mod(rootPc(flat[v].chord) + 2, 12), 'major');
    const arrive = t === undefined ? '' : rootPc(flat[t].chord) === pcOf(k.tonic) ? ` sur ${sym(t)}` : ` sur ${sym(t)} (le IIIm7, qui remplace le I)`;
    spots.push({
      type: 'back',
      accept: ['back'],
      starts: U(from),
      ends: [...U(v), ...(t !== undefined ? U(t) : [])],
      from,
      to: end[end.length - 1],
      target: k,
      explain: `${withIV ? `${sym(from)} – ` : ''}${sym(v)}${t !== undefined ? ` – ${sym(t)}` : ''} (${bars(from, end[end.length - 1])}) : backdoor de ${keyLabel(k)}. ${
        withIV ? 'IVm7 – ♭VII7 – I' : '♭VII7 – I'
      }, emprunté au mineur : on arrive${arrive} sans passer par le V7.`,
      main: true
    });
  };

  for (const b of an.brackets) {
    const ii = b.from;
    const v = b.to;
    for (let i = ii; i <= v; i++) inBracket.add(i);
    const vUnit = U(v);
    const t = b.target;
    const resolves = t !== undefined && t > v;
    const isBack = !!an.chords[v].backdoor;
    if (isBack) {
      backdoor(ii, v, true);
      continue;
    }
    if (b.kind === 'iiSubV') {
      const tgtPc = resolves ? rootPc(flat[t!].chord) : mod(rootPc(flat[v].chord) - 1, 12);
      const end = resolves ? U(t!) : vUnit;
      spots.push({
        type: 'subV',
        accept: ['subV', 'iiV'],
        starts: U(ii),
        ends: [...vUnit, ...(resolves ? U(t!) : [])],
        from: ii,
        to: end[end.length - 1],
        target: resolves ? keyAt(t!) : keyOnPc(tgtPc, 'major'),
        explain: `${sym(ii)} – ${sym(v)}${resolves ? ` – ${sym(t!)}` : ''} (${bars(ii, end[end.length - 1])}) : ii–SubV. Le V7 est remplacé par l’accord de 7 un triton plus loin, qui descend d’un demi-ton${resolves ? ` sur ${sym(t!)}` : ''}.`,
        main: true
      });
      continue;
    }
    if (resolves) {
      const minor = isMinorish(flat[t!]);
      const type: SpotType = minor ? 'iiVi' : 'iiVI';
      const end = U(t!);
      const k = keyAt(t!);
      spots.push({
        type,
        accept: [type, 'iiV', ...(minor ? (['iiVI'] as SpotType[]) : ([] as SpotType[]))],
        starts: U(ii),
        ends: [...vUnit, ...end],
        from: ii,
        to: end[end.length - 1],
        target: k,
        explain: `${sym(ii)} – ${sym(v)} – ${sym(t!)} (${bars(ii, end[end.length - 1])}) : ii–V–${minor ? 'i' : 'I'} vers ${keyLabel(k)}${
          family(flat[ii]) === 'hdim' ? ' (le IIø7 annonce le mineur)' : ''
        }.${via(t!)}`,
        main: true
      });
    } else {
      const tgtPc = mod(rootPc(flat[v].chord) + 5, 12);
      const minor = family(flat[ii]) === 'hdim';
      const k = keyOnPc(tgtPc, minor ? 'minor' : 'major');
      const after = (v + 1) % n;
      spots.push({
        type: 'iiV',
        accept: t !== undefined ? ['iiV', 'iiVI', 'iiVi'] : ['iiV'],
        starts: U(ii),
        ends: vUnit,
        from: ii,
        to: vUnit[vUnit.length - 1],
        target: k,
        explain: `${sym(ii)} – ${sym(v)} (${bars(ii, v)}) : ii–V de ${keyLabel(k)}, ${t !== undefined ? 'qui résout au début de la grille (elle boucle)' : `mais la grille part ailleurs (${sym(after)})`}.`,
        main: true
      });
    }
  }

  // Dominantes seules qui résolvent (hors ii–V).
  for (let u = 0; u < units.length; u++) {
    const i = units[u][0];
    const a = an.chords[i];
    if (inBracket.has(i) || !a.resolution || a.resolvesTo === undefined) continue;
    const t = a.resolvesTo;
    const resolves = t > i;
    const end = resolves ? U(t) : units[u];
    const to = end[end.length - 1];
    if (a.resolution === 'sub') {
      spots.push({
        type: 'subV',
        accept: ['subV'],
        starts: units[u],
        ends: [...units[u], ...(resolves ? U(t) : [])],
        from: i,
        to,
        target: keyAt(t),
        explain: `${sym(i)} → ${sym(t)} (${bars(i, to)}) : SubV, substitution tritonique : le 7 descend d’un demi-ton.`,
        main: true
      });
    } else {
      const secondary = pcOf(a.key.tonic) !== rootPc(flat[t].chord);
      spots.push({
        type: secondary ? 'sec' : 'VI',
        accept: ['sec', 'VI'],
        starts: units[u],
        ends: [...units[u], ...(resolves ? U(t) : [])],
        from: i,
        to,
        target: keyAt(t),
        explain: secondary
          ? `${sym(i)} → ${sym(t)} (${bars(i, to)}) : dominante secondaire. ${sym(i)} est le V7 de ${sym(t)}, qui n’est pas le I de ${keyLabel(a.key)} : on l’annonce comme une petite tonique.`
          : `${sym(i)} → ${sym(t)} (${bars(i, to)}) : V–I, la dominante résout sur la tonique de ${keyLabel(a.key)}.`,
        main: true
      });
    }
  }

  // Backdoor sans IVm7.
  for (let u = 0; u < units.length; u++) {
    const i = units[u][0];
    if (an.chords[i].backdoor && !inBracket.has(i)) backdoor(i, i, false);
  }

  // Turnarounds : I (ou III) – VI – II – V, sur 4 accords courts consécutifs.
  for (let u = 0; u + 3 < units.length; u++) {
    const idx = [0, 1, 2, 3].map((k) => units[u + k][0]);
    const r = idx.map((i) => rootPc(flat[i].chord));
    const k = mod(r[3] - 7, 12);
    const d = r.map((x) => mod(x - k, 12));
    const short = idx.every((i) => units[unitOf[i]].reduce((s, j) => s + flat[j].beats, 0) <= beatsPerBar);
    const f = idx.map((i) => family(flat[i]));
    const iOk = d[0] === 0 ? f[0] === 'maj' || f[0] === 'dom' : d[0] === 4 && f[0] === 'min';
    const local = idx.every((i) => pcOf(an.chords[i].key.tonic) === k || i === idx[1] || i === idx[2]);
    if (!short || !iOk || !local || d[1] !== 9 || d[2] !== 2 || d[3] !== 7 || f[3] !== 'dom' || f[1] === 'maj' || f[2] === 'maj') continue;
    const last = units[u + 3];
    const key = keyOnPc(k, 'major');
    spots.push({
      type: 'turn',
      accept: ['turn'],
      starts: units[u],
      ends: last,
      from: idx[0],
      to: last[last.length - 1],
      target: key,
      explain: `${idx.map(sym).join(' – ')} (${bars(idx[0], last[last.length - 1])}) : turnaround ${d[0] === 4 ? 'III' : 'I'}–VI–II–V de ${keyLabel(key)}, pour relancer la grille.`,
      main: false
    });
  }
  return spots.sort((a, b) => a.from - b.from || a.to - b.to);
}

/** Corrige les repérages de l'élève : juste, presque, faux ; ce qu'il a manqué ; et les choses à voir en plus. */
export function correct(marks: Mark[], spots: Spot[], flat: FlatChord[], an: Analysis): Correction {
  /** Repères trouvés (juste) et repères vus (bonnes bornes, nom ou tonalité à revoir). */
  const used = new Set<Spot>();
  const seen = new Set<Spot>();
  const sym = (i: number) => chordSymbol(flat[i].chord);
  const results: MarkResult[] = marks.map((m) => {
    const exact = spots.find((s) => s.starts.includes(m.from) && s.ends.includes(m.to) && s.accept.includes(m.type));
    const sameSpan = exact ?? spots.find((s) => s.starts.includes(m.from) && s.ends.includes(m.to));
    if (sameSpan) {
      const s = sameSpan;
      const keyOk = mod(m.target - pcOf(s.target.tonic), 12) === 0;
      const typeOk = s.accept.includes(m.type);
      seen.add(s);
      if (typeOk && keyOk) {
        used.add(s);
        const alias = m.type !== s.type ? ` On peut même dire : ${SPOT_LABEL[s.type]}.` : '';
        return { mark: m, verdict: 'ok', text: s.explain + alias, spot: s };
      }
      if (typeOk) return { mark: m, verdict: 'near', text: `Bon enchaînement, mais il va vers ${keyLabel(s.target)}, pas ${noteName(keyOnPc(m.target, 'major').tonic)}. ${s.explain}`, spot: s };
      return { mark: m, verdict: 'bad', text: `Ce n’est pas un ${SPOT_LABEL[m.type]} : ${s.explain}`, spot: s };
    }
    // Chevauche un enchaînement, mais avec d'autres bornes.
    const over = spots.find((s) => s.main && m.from <= s.to && s.from <= m.to);
    if (over) seen.add(over);
    if (over) return { mark: m, verdict: 'near', text: `Presque : l’enchaînement va de ${sym(over.from)} à ${sym(over.to)}. ${over.explain}`, spot: over };
    const why = an.chords[m.from]?.explain ?? '';
    return { mark: m, verdict: 'bad', text: `Pas d’enchaînement type de ${sym(m.from)} à ${sym(m.to)}. ${why}` };
  });
  // Un turnaround trouvé couvre les ii–V qu'il contient.
  const turnsFound = [...used].filter((s) => s.type === 'turn');
  const covered = (s: Spot) => used.has(s) || turnsFound.some((t) => t.from <= s.from && s.from <= t.to);
  const mains = spots.filter((s) => s.main);
  const missed = spots.filter((s) => !covered(s) && !seen.has(s));
  const found = mains.filter(covered).length;
  // À voir en plus : changements de tonalité, diminués de passage.
  const extras: string[] = [];
  const keys = new Set(an.regions.map((r) => keyLabel(r.key)));
  if (keys.size > 1)
    extras.push(
      `La grille change de tonalité : ${an.regions
        .map((r) => `${keyLabel(r.key)} (mes. ${flat[r.from].bar + 1}${flat[r.to].bar !== flat[r.from].bar ? `–${flat[r.to].bar + 1}` : ''})`)
        .filter((x, i, a) => a.indexOf(x) === i)
        .slice(0, 6)
        .join(', ')}.`
    );
  an.chords.forEach((a, i) => {
    if (a.explain.startsWith('Diminué de passage') && (i === 0 || an.chords[i - 1].explain !== a.explain)) extras.push(`${sym(i)} (mes. ${flat[i].bar + 1}) : ${a.explain}`);
  });
  return { results, missed, extras, found, total: mains.length };
}
