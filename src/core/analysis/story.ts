// « Comprendre » un morceau : son analyse racontée phrase par phrase, en mots simples.
// Une phrase = une ligne de la grille telle qu'elle est écrite. Pour chacune : ce qui s'y passe (ii–V–I, dominante
// secondaire, suite connue de la pop, emprunt au mineur, accord tenu…), et si elle répète une phrase déjà vue.
// Tout vient de l'analyse (analyze.ts) et des enchaînements repérés (spots.ts).
import { Chart, FlatChord, Key, keyLabel } from '../chart/model';
import { phraseRows } from '../chart/layout';
import { QUALITIES, chordSymbol, rootPc } from '../theory/chords';
import { mod, pcOf } from '../theory/notes';
import { SCALES } from '../theory/scales';
import { Analysis, romanIn } from './analyze';
import { ScaleChoice } from './improv';
import { Spot, SpotType, findSpots } from './spots';

/** Ce qu'on retient d'une phrase (sert aussi de bonne réponse au quiz). */
export type Tag = SpotType | 'pop' | 'rock' | 'borrow' | 'static' | 'blues' | 'minor' | 'tonic';

export const TAG_LABEL: Record<Tag, string> = {
  iiVI: 'Un ii–V–I majeur',
  iiVi: 'Un ii–V–i mineur',
  iiV: 'Un ii–V qui ne se résout pas',
  VI: 'Une cadence V–I',
  sec: 'Une dominante secondaire',
  subV: 'Une substitution tritonique',
  back: 'Un backdoor',
  turn: 'Un turnaround',
  pop: 'Une suite connue de la pop',
  rock: 'Une suite rock (♭VII, ♭VI)',
  borrow: 'Un accord emprunté au mineur',
  static: 'Un seul accord tenu',
  blues: 'La couleur blues (I7, IV7)',
  minor: 'La cadence mineure (iv, V, i)',
  tonic: 'Les accords de la gamme, autour du I'
};
/** En une ligne, ce que veut dire chaque étiquette (pour le quiz). */
export const TAG_HINT: Record<Tag, string> = {
  iiVI: 'II mineur, V7, puis I majeur',
  iiVi: 'IIø7, V7, puis i mineur',
  iiV: 'II puis V, mais pas le I attendu',
  VI: 'la dominante qui revient au repos',
  sec: 'un accord 7 (ou majeur) hors de la gamme, qui prépare l’accord suivant',
  subV: 'un 7 un demi-ton au-dessus de l’accord visé',
  back: '♭VII7 qui ramène au I',
  turn: 'I – VI – II – V, pour relancer',
  pop: 'I, IV, V et vi dans un ordre connu',
  rock: 'des accords majeurs pris au mode mineur',
  borrow: 'un accord du mode mineur dans une tonalité majeure',
  static: 'on reste sur la même couleur',
  blues: 'des accords 7 sur le I et le IV',
  minor: 'iv – V – i, l’aller-retour du mineur',
  tonic: 'des accords de la tonalité, sans surprise'
};

export interface StoryChord {
  index: number;
  symbol: string;
  /** Degré affiché sous l'accord : chiffrage jazz (IIm7, V7/II) ou pop (ii, V, ♭VII). */
  degree: string;
  bar: number;
}
export interface Phrase {
  /** Mesures (à partir de 0), bornes comprises. */
  from: number;
  to: number;
  section?: string;
  chords: StoryChord[];
  key: Key;
  title: string;
  text: string;
  tag: Tag;
  /** Tout ce qu'on y a trouvé (le titre en premier) : pour ne pas proposer au quiz une « mauvaise » réponse qui serait juste. */
  tags: Tag[];
  /** Réponse du quiz : une étiquette (« sec ») ou une suite connue (« n:I-V-vi-IV »), et toutes celles qui seraient justes aussi. */
  answer: string;
  truths: string[];
  /** Degré affiché sous chaque accord de la phrase (indice dans la grille à plat). */
  degrees: Record<number, string>;
  /** Indice d'une phrase identique déjà vue. */
  same?: number;
}
export interface Story {
  summary: string[];
  phrases: Phrase[];
}

/** Suites connues, en degrés simplifiés (majuscule : accord majeur, minuscule : mineur). */
const NAMED: { seq: string[]; tag: Tag; title: string; text: (chords: string) => string }[] = [
  {
    seq: ['I', 'V', 'vi', 'IV'],
    tag: 'pop',
    title: 'I – V – vi – IV : la suite de la pop',
    text: (c) => `${c} : I – V – vi – IV, la suite la plus jouée de la pop et du rock. Trois accords majeurs et un mineur, le vi, qui donne la touche mélancolique.`
  },
  {
    seq: ['vi', 'IV', 'I', 'V'],
    tag: 'pop',
    title: 'vi – IV – I – V : la suite pop, côté mineur',
    text: (c) => `${c} : vi – IV – I – V. Les quatre accords de I – V – vi – IV, mais on part du mineur : plus sombre.`
  },
  {
    seq: ['I', 'vi', 'IV', 'V'],
    tag: 'pop',
    title: 'I – vi – IV – V : la suite des années 50',
    text: (c) => `${c} : I – vi – IV – V, la suite des slows et du doo-wop. Le V à la fin relance vers le I.`
  },
  {
    seq: ['I', 'vi', 'ii', 'V'],
    tag: 'pop',
    title: 'I – vi – ii – V : le tour de manège',
    text: (c) => `${c} : I – vi – ii – V. Chaque accord tombe une quinte plus bas sur le suivant, et le V ramène au I : la suite tourne en boucle.`
  },
  {
    seq: ['I', 'V', 'ii', 'V'],
    tag: 'pop',
    title: 'I – V – ii – V : l’aller-retour',
    text: (c) => `${c} : I – V – ii – V. On quitte le repos (I) pour la tension (V), deux fois, en passant par le ii : la phrase reste suspendue sur le V.`
  },
  {
    seq: ['vi', 'V', 'IV', 'I'],
    tag: 'pop',
    title: 'vi – V – IV – I : la descente',
    text: (c) => `${c} : vi – V – IV – I. La basse descend note à note, du mineur vers le repos.`
  },
  {
    seq: ['I', 'iii', 'vi', 'ii'],
    tag: 'pop',
    title: 'I – iii – vi – ii : de quinte en quinte',
    text: (c) => `${c} : I – iii – vi – ii (– V). Chaque accord est une quinte au-dessus du suivant : la grille glisse d'elle-même vers le V, puis le I.`
  },
  {
    seq: ['I', 'iii', 'vi'],
    tag: 'pop',
    title: 'I – iii – vi : trois accords cousins',
    text: (c) => `${c} : I – iii – vi. Trois accords qui ont deux notes en commun deux à deux : on change de couleur sans secousse.`
  },
  {
    seq: ['I', 'IV', 'V'],
    tag: 'pop',
    title: 'I – IV – V : les trois accords du rock',
    text: (c) => `${c} : I – IV – V, les trois accords majeurs de la gamme. La base du rock, du blues et de la chanson.`
  },
  {
    seq: ['I', 'V', 'IV'],
    tag: 'pop',
    title: 'I – V – IV',
    text: (c) => `${c} : I – V – IV, les trois accords majeurs de la gamme ; le V va vers le IV au lieu de revenir au I : son rock.`
  },
  {
    seq: ['I', 'V', 'ii'],
    tag: 'pop',
    title: 'I – V – ii',
    text: (c) => `${c} : I – V – ii, trois accords de la gamme ; la phrase s'arrête sur le ii, sans revenir au repos.`
  },
  {
    seq: ['I', 'bVII', 'IV'],
    tag: 'rock',
    title: 'I – ♭VII – IV : le son rock',
    text: (c) => `${c} : I – ♭VII – IV. Le ♭VII n'est pas dans la gamme majeure : il vient du mode mineur, c'est le son du rock.`
  },
  {
    seq: ['i', 'bVI', 'bIII', 'bVII'],
    tag: 'rock',
    title: 'i – ♭VI – ♭III – ♭VII : l’épique du rock',
    text: (c) => `${c} : i – ♭VI – ♭III – ♭VII. En mineur, trois accords majeurs (♭VI, ♭III, ♭VII) qui sonnent grand et dramatique : la suite des ballades rock.`
  },
  {
    seq: ['i', 'bVI', 'bVII'],
    tag: 'rock',
    title: 'i – ♭VI – ♭VII : la cadence épique',
    text: (c) => `${c} : i – ♭VI – ♭VII, la cadence « épique » du rock en mineur : on remonte vers la tonique par deux accords majeurs.`
  },
  {
    seq: ['bVI', 'bVII', 'i'],
    tag: 'rock',
    title: '♭VI – ♭VII – i : la montée épique',
    text: (c) => `${c} : ♭VI – ♭VII – i, deux accords majeurs qui montent d'un ton vers le mineur : la fin « épique » du rock.`
  },
  {
    seq: ['i', 'bVII', 'bVI', 'V'],
    tag: 'rock',
    title: 'La descente andalouse',
    text: (c) => `${c} : i – ♭VII – ♭VI – V, la basse descend note à note jusqu'au V majeur, qui ramène au i. Flamenco, rock, chanson.`
  },
  {
    seq: ['iv', 'i', 'V', 'i'],
    tag: 'minor',
    title: 'iv – i – V – i : la cadence mineure',
    text: (c) => `${c} : iv – i – V – i. Le iv s'éloigne, le V (majeur, avec la sensible) tend, le i repose.`
  },
  {
    seq: ['i', 'iv', 'V', 'i'],
    tag: 'minor',
    title: 'i – iv – V – i : la cadence mineure',
    text: (c) => `${c} : i – iv – V – i, l'aller-retour de base en mineur. Le V est majeur : sa 3ce, la sensible, tire vers la tonique.`
  },
  {
    seq: ['iv', 'V', 'i'],
    tag: 'minor',
    title: 'iv – V – i : la cadence mineure',
    text: (c) => `${c} : iv – V – i, la cadence de base en mineur. Le V est majeur : sa 3ce, la sensible, tire vers la tonique.`
  },
  {
    seq: ['I', 'III', 'IV', 'iv'],
    tag: 'borrow',
    title: 'I – III – IV – iv',
    text: (c) => `${c} : I – III – IV – iv. Le III majeur et le iv mineur ne sont pas dans la gamme : le premier éclaire, le second, emprunté au mineur, assombrit.`
  }
];

const P = (s: string) => s.replace(/b/g, '♭').replace(/#/g, '♯');
const namedId = (seq: string[]) => 'n:' + seq.join('-');

/** Une réponse possible au quiz : une étiquette, ou une suite connue. */
export interface Answer {
  id: string;
  label: string;
  hint: string;
  /** Famille, pour proposer des réponses voisines : pop, rock, mineur… */
  family: Tag;
}
/** Toutes les réponses possibles : les suites connues d'abord, puis les étiquettes. */
export function answers(): Answer[] {
  return [
    ...NAMED.map((n) => ({ id: namedId(n.seq), label: P(n.seq.join(' – ')), hint: n.title.split(' : ')[1] ?? n.title, family: n.tag })),
    ...(Object.keys(TAG_LABEL) as Tag[]).map((t) => ({ id: t, label: TAG_LABEL[t], hint: TAG_HINT[t], family: t }))
  ];
}
export const answerById = (id: string): Answer | undefined => answers().find((a) => a.id === id);

/** Degré simplifié d'un accord dans une tonalité : « V », « vi », « bVII », « vii° ». */
export function simpleDegree(roman: string, quality: string): string {
  const deg = roman.replace(/^SubV.*/, '').match(/^[♭♯]*[IV]+/)?.[0] ?? '';
  const fam = QUALITIES[quality]?.family;
  const d = deg.replace(/♭/g, 'b').replace(/♯/g, '#');
  if (!d) return roman;
  if (fam === 'min') return d.toLowerCase();
  if (fam === 'dim' || fam === 'hdim') return d.toLowerCase() + '°';
  return d;
}

const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
/** Où la suite contient le motif (accords consécutifs), ou -1. */
function findSeq(seq: string[], pat: string[]): number {
  for (let s = 0; s + pat.length <= seq.length; s++) if (same(seq.slice(s, s + pat.length), pat)) return s;
  return -1;
}

const bars = (a: number, b: number) => (a === b ? `mesure ${a + 1}` : `mesures ${a + 1}–${b + 1}`);
const keyEq = (a: Key, b: Key) => pcOf(a.tonic) === pcOf(b.tonic) && a.mode === b.mode;
/** Degrés de la gamme mineure naturelle (demi-tons depuis la tonique) qui portent un accord majeur. */
const MINOR_MAJOR_DEGREES = [3, 8, 10];

/** L'histoire d'une grille. scales : la gamme de chaque accord (improvPlan). */
export function storyOf(chart: Chart, flat: FlatChord[], an: Analysis, scales?: ScaleChoice[]): Story {
  const jazz = (chart.genre ?? 'jazz') === 'jazz';
  const spots = findSpots(flat, an, chart.beatsPerBar).filter((s) => s.main);
  const rows = phraseRows(chart);
  const phrases: Phrase[] = [];
  const signatures: string[] = [];
  let prevKey: Key | null = null;
  const seenKeys: Key[] = [];

  rows.forEach((row) => {
    const from = row.bars[0];
    const to = row.bars[row.bars.length - 1];
    const idx = flat.filter((f) => f.bar >= from && f.bar <= to).map((f) => f.index);
    if (!idx.length) return;
    // Tonalité de la phrase : celle qui dure le plus.
    const weight = new Map<string, { key: Key; beats: number }>();
    idx.forEach((i) => {
      const k = an.chords[i].key;
      const id = `${pcOf(k.tonic)}${k.mode}`;
      const w = weight.get(id) ?? { key: k, beats: 0 };
      w.beats += flat[i].beats;
      weight.set(id, w);
    });
    const key = [...weight.values()].sort((a, b) => b.beats - a.beats)[0].key;
    // Accords de la phrase, sans répéter un accord tenu.
    const chords: StoryChord[] = [];
    const degrees: Record<number, string> = {};
    idx.forEach((i) => {
      const roman = an.chords[i].roman;
      degrees[i] = jazz || roman.includes('/') || roman.startsWith('Sub') ? roman : P(simpleDegree(romanIn(flat[i].chord, key), flat[i].chord.quality)) + (flat[i].chord.quality === '7' ? '7' : '');
      const sym = chordSymbol(flat[i].chord);
      const last = chords[chords.length - 1];
      if (last && last.symbol === sym) return;
      chords.push({ index: i, symbol: sym, degree: degrees[i], bar: flat[i].bar });
    });
    const sig = row.bars.map((b) => flat.filter((f) => f.bar === b).map((f) => chordSymbol(f.chord)).join(' ')).join('|');
    const sameAs = signatures.indexOf(sig);
    signatures.push(sig);
    const section = row.label;

    if (sameAs >= 0) {
      const p = phrases[sameAs];
      phrases.push({ from, to, section, chords, key, title: `Comme ${bars(p.from, p.to)}`, text: 'Les mêmes accords : une reprise.', tag: p.tag, tags: p.tags, answer: p.answer, truths: p.truths, degrees, same: sameAs });
      prevKey = key;
      return;
    }

    const parts: string[] = [];
    let title = '';
    let tag = 'tonic' as Tag;
    const found: Tag[] = [];
    const setTitle = (t: string, g: Tag) => {
      if (!found.includes(g)) found.push(g);
      if (!title) {
        title = t;
        tag = g;
      }
    };
    // Changement de tonalité.
    if (prevKey && !keyEq(prevKey, key)) {
      const back = seenKeys.some((k) => keyEq(k, key));
      const rel = prevKey.mode !== key.mode && mod(pcOf(prevKey.tonic) + (prevKey.mode === 'major' ? 9 : 3), 12) === pcOf(key.tonic);
      parts.push(back ? `Retour en ${keyLabel(key)}.` : `On passe en ${keyLabel(key)}${rel ? ' (le relatif : même armure)' : ''}.`);
    }
    if (!seenKeys.some((k) => keyEq(k, key))) seenKeys.push(key);
    prevKey = key;

    const units = chords.map((c) => simpleDegree(romanIn(flat[c.index].chord, key), flat[c.index].chord.quality));
    const covered = new Set<number>();

    // 1. Un seul accord pendant toute la phrase.
    if (chords.length === 1 && to > from) {
      const sc = scales?.[chords[0].index];
      setTitle(`Un seul accord : ${chords[0].symbol}`, 'static');
      parts.push(`${chords[0].symbol} tenu pendant ${to - from + 1} mesures : on reste dans sa couleur${sc ? ` (gamme : ${SCALES[sc.scale].name})` : ''}.`);
    }

    // 2. Suites connues de la pop et du rock (en premier hors du jazz).
    const allNamed = chords.length > 1 ? NAMED.filter((n) => findSeq(units, n.seq) >= 0) : [];
    const named = allNamed[0];
    // Les accords de la suite reconnue, tels qu'ils sont joués.
    const list = named ? chords.slice(findSeq(units, named.seq), findSeq(units, named.seq) + named.seq.length).map((c) => c.symbol).join(' – ') : '';
    if (named && !jazz) {
      parts.push(named.text(list));
      setTitle(named.title, named.tag);
    }

    // 3. Enchaînements repérés (ii–V–I, dominantes…) qui commencent dans la phrase.
    const here = spots.filter((s) => flat[s.from].bar >= from && flat[s.from].bar <= to);
    for (const s of here) {
      // Hors du jazz, un ii–V–I « en boucle » dans une suite pop déjà nommée ne mérite pas d'être raconté deux fois.
      if (named && !jazz && (s.type === 'iiVI' || s.type === 'iiV' || s.type === 'VI')) continue;
      parts.push(sentence(s, flat, an, jazz));
      for (let i = s.from; i <= s.to; i++) covered.add(i);
      setTitle(spotTitle(s, flat), s.type);
    }
    if (named && jazz && !here.some((s) => s.type === 'iiVI' || s.type === 'iiVi')) {
      parts.push(named.text(list));
      if (tag === 'VI' || tag === 'sec') title = '';
      setTitle(named.title, named.tag);
      if (found[0] !== tag) found.unshift(...found.splice(found.indexOf(tag), 1));
    }

    // 4. Dominantes secondaires sans 7e (pop, chanson) : un accord majeur hors de la gamme, une quinte au-dessus du suivant.
    chords.forEach((c, k) => {
      if (covered.has(c.index)) return;
      const ch = flat[c.index].chord;
      const fam = QUALITIES[ch.quality].family;
      if (fam !== 'maj' && fam !== 'dom') return;
      const d = mod(rootPc(ch) - pcOf(key.tonic), 12);
      const inScale = key.mode === 'major' ? [0, 5, 7].includes(d) : MINOR_MAJOR_DEGREES.includes(d) || d === 7;
      if (inScale || (key.mode === 'major' && (d === 10 || d === 8 || d === 3))) return;
      const target = mod(rootPc(ch) + 5, 12);
      const next = chords[k + 1] ?? chords[0];
      const tgtName = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'][target];
      const tgtDeg = mod(target - pcOf(key.tonic), 12);
      const minorTarget = key.mode === 'major' ? [2, 4, 9].includes(tgtDeg) : [0, 5].includes(tgtDeg);
      const resolves = next && rootPc(flat[next.index].chord) === target;
      parts.push(
        `${c.symbol} n'est pas dans la gamme de ${keyLabel(key)} : c'est la dominante de ${tgtName}${minorTarget ? 'm' : ''}${
          resolves ? `, qu'il prépare juste après (dominante secondaire).` : ` (dominante secondaire) ; ici la résolution attendue est évitée ou retardée.`
        }`
      );
      covered.add(c.index);
      setTitle(`${c.symbol} : dominante secondaire`, 'sec');
    });

    // 5. Accords empruntés au mineur (♭VII, ♭VI, ♭III, iv en majeur), s'ils ne sont pas déjà expliqués.
    if (key.mode === 'major' && !(named && named.tag !== 'pop')) {
      const borrowed = chords.filter((c, k) => !covered.has(c.index) && /^(bVII|bVI|bIII|iv|bvi|biii)$/.test(units[k]) && !an.chords[c.index].backdoor);
      if (borrowed.length) {
        parts.push(
          `${borrowed.map((c, k) => `${c.symbol} (${P(units[chords.indexOf(c)] ?? units[k])})`).join(', ')} : ${borrowed.length > 1 ? 'des accords empruntés' : 'un accord emprunté'} au mode mineur de ${keyLabel({ ...key, mode: 'minor' }).replace(' mineur', '')}, qui assombrit ou durcit le son.`
        );
        borrowed.forEach((c) => covered.add(c.index));
        setTitle('Emprunt au mineur', 'borrow');
      }
    }

    // 6. Blues : I7 et IV7.
    const bluesAll = chords.filter((c) => an.chords[c.index].explain.startsWith('Couleur blues'));
    const blues = bluesAll.filter((c) => !covered.has(c.index));
    // Déjà raconté (résolution d'un ii–V…) : pas de phrase de plus, mais « couleur blues » reste une réponse juste.
    if (bluesAll.length && !blues.length && !found.includes('blues')) found.push('blues');
    if (blues.length) {
      setTitle('Couleur blues', 'blues');
      parts.push(`${blues.map((c) => c.symbol).join(', ')} : ${blues.length > 1 ? 'des accords de 7' : 'un accord de 7'} là où la gamme majeure en mettrait un majeur. C'est la couleur du blues.`);
    }

    // 7. Le reste : les degrés de la phrase, et où sont la tension et le repos.
    if (!title) {
      const degs = chords.map((c) => c.degree).join(' – ');
      const tension = chords.find((c) => {
        const d = mod(rootPc(flat[c.index].chord) - pcOf(key.tonic), 12);
        return d === 7 || QUALITIES[flat[c.index].chord.quality].family === 'dom';
      });
      const rest = chords.find((c) => mod(rootPc(flat[c.index].chord) - pcOf(key.tonic), 12) === 0 && QUALITIES[flat[c.index].chord.quality].family !== 'dom');
      setTitle(rest ? `Autour de ${rest.symbol}, le repos` : `En ${keyLabel(key)}`, 'tonic');
      parts.push(
        `Des accords de la gamme de ${keyLabel(key)} : ${degs}.${tension ? ` ${tension.symbol} (${tension.degree}) crée la tension${rest ? `, ${rest.symbol} (${rest.degree}) est le repos` : ''}.` : rest ? ` ${rest.symbol} (${rest.degree}) est le repos.` : ''}`
      );
    }
    const tags = found.length ? found : [tag];
    const answer = named && tag === named.tag && title === named.title ? namedId(named.seq) : tag;
    // ♭VI, ♭VII ou ♭III dans la phrase : « suite rock » ou « emprunt » seraient à moitié justes, pas de piège au quiz.
    const near: string[] = units.some((u) => /^b(VII|VI|III)$/.test(u)) ? ['rock', 'borrow'] : [];
    // Une suite connue presque entière (♭VI – ♭VII de i – ♭VI – ♭VII…) : idem. Pas « I – V », trop courant pour compter.
    for (const n of NAMED)
      if (n.seq.length >= 3 && !allNamed.includes(n) && [n.seq.slice(1), n.seq.slice(0, -1)].some((part) => !/^i$/i.test(part[0]) && findSeq(units, part) >= 0)) near.push(namedId(n.seq));
    phrases.push({ from, to, section, chords, key, title, text: parts.join(' '), tag, tags, answer, truths: [...new Set([...tags, ...allNamed.map((n) => namedId(n.seq)), ...near])], degrees });
  });

  return { summary: summaryOf(chart, an, spots, phrases), phrases };
}

/** Titre d'une phrase d'après son enchaînement principal. */
function spotTitle(s: Spot, flat: FlatChord[]): string {
  const k = keyLabel(s.target);
  const sym = (i: number) => chordSymbol(flat[i].chord);
  switch (s.type) {
    case 'iiVI':
      return `ii–V–I en ${k}`;
    case 'iiVi':
      return `ii–V–i en ${k}`;
    case 'iiV':
      return `ii–V vers ${k}, sans y aller`;
    case 'VI':
      return `V–I : retour au repos`;
    case 'sec':
      return `${sym(s.from)} : dominante secondaire`;
    case 'subV':
      return `${sym(s.from)} : substitution tritonique`;
    case 'back':
      return `Backdoor vers ${k}`;
    case 'turn':
      return 'Turnaround';
  }
}

/** Une phrase en mots simples pour un enchaînement repéré. */
function sentence(s: Spot, flat: FlatChord[], an: Analysis, jazz: boolean): string {
  const sym = (i: number) => chordSymbol(flat[i].chord);
  const after = (i: number) => {
    for (let j = i + 1; j < flat.length; j++) if (sym(j) !== sym(i)) return j;
    return undefined;
  };
  const k = keyLabel(s.target);
  const ii = s.from;
  const v = after(ii);
  switch (s.type) {
    case 'iiVI':
    case 'iiVi': {
      const t = v !== undefined ? after(v) : undefined;
      const minor = s.type === 'iiVi';
      const notTonic = t !== undefined && pcOf(an.chords[t].key.tonic) !== rootPc(flat[t].chord);
      return `${sym(ii)} prépare, ${v !== undefined ? sym(v) : '…'} tend, ${t !== undefined ? sym(t) : '…'} repose : un ii–V–${minor ? 'i' : 'I'}${jazz ? ', l’enchaînement le plus fréquent du jazz,' : ''} en ${k}.${
        notTonic && t !== undefined ? ` Ici ${sym(t)} n'est qu'une étape (le ${an.chords[t].roman} de ${keyLabel(an.chords[t].key)}) : on le met en valeur avec sa propre cadence.` : ''
      }`;
    }
    case 'iiV': {
      const nx = v !== undefined ? after(v) : undefined;
      return `${sym(ii)} – ${v !== undefined ? sym(v) : '…'} : un ii–V qui annonce ${k}, mais ${nx !== undefined ? `${sym(nx)} arrive à la place` : 'la grille repart au début'} : la résolution est évitée, l'oreille est surprise.`;
    }
    case 'VI':
      return `${sym(s.from)} se résout sur ${v !== undefined ? sym(v) : 'le I'} : la tension retombe sur la tonique (cadence V–I).`;
    case 'sec':
      return `${sym(s.from)} est la dominante de ${v !== undefined ? sym(v) : 'l’accord suivant'} (dominante secondaire) : il le prépare comme si c'était une tonique, avec une note étrangère à la gamme.`;
    case 'subV': {
      const eqPc = mod(rootPc(flat[s.from].chord) + 6, 12);
      const names = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
      const tgt = s.to !== s.from ? sym(s.to) : 'l’accord suivant';
      return `${sym(s.from)} remplace ${names[eqPc]}7 (substitution tritonique : même tension) ; la basse descend d'un demi-ton vers ${tgt}.`;
    }
    case 'back':
      return `${s.explain.split(' (')[0]} : le « backdoor », un retour vers ${k} emprunté au mode mineur, sans passer par le V7.`;
    case 'turn':
      return `${s.explain.split(' (')[0]} : un turnaround (I – VI – II – V) qui relance la grille vers son début.`;
  }
}

/** En bref : tonalités, forme, ce qu'on y trouve. */
function summaryOf(chart: Chart, an: Analysis, spots: Spot[], phrases: Phrase[]): string[] {
  const out: string[] = [];
  const keys: Key[] = [];
  an.regions.forEach((r) => {
    if (!keys.some((k) => keyEq(k, r.key))) keys.push(r.key);
  });
  const home = keyLabel(chart.key);
  const others = keys.filter((k) => !keyEq(k, chart.key)).map(keyLabel);
  out.push(`Tonalité : ${home}.${others.length ? ` On passe aussi par ${others.slice(0, 4).join(', ')}${others.length > 4 ? '…' : ''}.` : ''}`);
  const sections = chart.bars.map((b) => b.section).filter((x): x is string => !!x);
  out.push(`${chart.bars.length} mesures${sections.length > 1 ? `, en ${sections.length} parties : ${sections.join(', ')}` : ''}.`);
  const count = new Map<Tag, number>();
  phrases.filter((p) => p.same === undefined).forEach((p) => count.set(p.tag, (count.get(p.tag) ?? 0) + 1));
  spots.forEach((s) => count.set(s.type, Math.max(count.get(s.type) ?? 0, spots.filter((x) => x.type === s.type).length)));
  const top = [...count.entries()]
    .filter(([t]) => t !== 'tonic')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t, n]) => `${TAG_LABEL[t].replace(/^Une? /, '').replace(/^La /, '').replace(/^Les /, '')}${n > 1 ? ` (${n})` : ''}`);
  if (top.length) out.push(`À repérer : ${top.join(', ')}.`);
  const repeats = phrases.filter((p) => p.same !== undefined).length;
  if (repeats) out.push(`${repeats} phrase${repeats > 1 ? 's' : ''} sur ${phrases.length} ${repeats > 1 ? 'reviennent' : 'revient'} à l'identique : il y a moins à apprendre qu'il n'y paraît.`);
  return out;
}
