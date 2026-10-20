// Le côté ludique : points (XP), grades, étoiles par niveau et déblocage, objectif du jour et série,
// 3 défis par jour, badges, collection de standards. Tout part des événements envoyés par les exercices.
import { load, save } from './storage';

// ---------------------------------------------------------------- Exercices et niveaux

/** Exercices notés par niveau (identifiant → nombre de niveaux, nom). */
export const EXOS: Record<string, { levels: number; name: string; href: string }> = {
  lecture: { levels: 4, name: 'Notes', href: '#/lecture' },
  tonalite: { levels: 5, name: 'Accords', href: '#/tonalite' },
  express: { levels: 4, name: 'Enchaînements', href: '#/express' },
  'oreille-iv': { levels: 5, name: 'Oreille · intervalles', href: '#/oreille/iv' },
  'oreille-ear': { levels: 5, name: 'Oreille · accords', href: '#/oreille/ear' },
  'oreille-full': { levels: 5, name: 'Oreille · accord entier', href: '#/oreille/full' },
  'oreille-prog': { levels: 5, name: 'Oreille · progressions', href: '#/oreille/prog' },
  'oreille-bass': { levels: 5, name: 'Oreille · ligne de basse', href: '#/oreille/bass' },
  'oreille-build': { levels: 5, name: 'Oreille · construire', href: '#/oreille/build' },
  'rythme-tempo': { levels: 5, name: 'Rythme · tenir le tempo', href: '#/rythme/tempo' },
  'rythme-taper': { levels: 6, name: 'Rythme · lire et taper', href: '#/rythme/taper' },
  'rythme-oreille': { levels: 6, name: 'Rythme · reconnaître un rythme', href: '#/rythme/oreille' },
  'rythme-style': { levels: 1, name: 'Rythme · reconnaître un style', href: '#/rythme/style' },
  flash: { levels: 4, name: 'Voicings', href: '#/flash' }
};
/** Taille de la fenêtre glissante qui donne les étoiles d'un niveau. */
export const WINDOW = 20;
/** Étoiles selon la réussite sur les 20 dernières réponses du niveau. */
export const starsFor = (acc: number) => (acc >= 0.97 ? 3 : acc >= 0.9 ? 2 : acc >= 0.8 ? 1 : 0);

// ---------------------------------------------------------------- Grades

export const GRADES = [
  { name: 'Auditeur', xp: 0 },
  { name: 'Apprenti', xp: 1000 },
  { name: 'Sideman', xp: 5000 },
  { name: 'Accompagnateur', xp: 15000 },
  { name: 'Soliste', xp: 35000 },
  { name: 'Leader', xp: 70000 }
];
export function gradeOf(xp: number) {
  let i = 0;
  while (i + 1 < GRADES.length && xp >= GRADES[i + 1].xp) i++;
  const next = GRADES[i + 1];
  return { index: i, name: GRADES[i].name, next: next?.name, toNext: next ? next.xp - xp : 0, progress: next ? (xp - GRADES[i].xp) / (next.xp - GRADES[i].xp) : 1 };
}

// ---------------------------------------------------------------- État

export interface Challenge {
  id: string;
  text: string;
  /** Événement compté, et filtre. */
  kind: 'answers' | 'duel' | 'analyse' | 'lesson' | 'tempo';
  exo?: string;
  goal: number;
  done: number;
  href: string;
}
export interface GameState {
  xp: number;
  /** Activité par jour (AAAA-MM-JJ) : points et temps actif (ms). */
  days: Record<string, { xp: number; ms: number }>;
  goalMin: number;
  /** Fenêtre glissante des dernières réponses, par « exo:niveau ». */
  recent: Record<string, number[]>;
  stars: Record<string, number>;
  /** Plus haut niveau ouvert, par exercice. */
  unlocked: Record<string, number>;
  badges: Record<string, number>;
  challenges: { date: string; list: Challenge[]; bonus: boolean };
  /** Standards : ce qui est validé pour chaque grille. */
  standards: Record<string, { analyse?: boolean; guide?: boolean; comp?: boolean }>;
  /** Séries de bonnes réponses en cours, par exercice. */
  streaks: Record<string, number>;
  /** Sons et animations des récompenses. */
  fx: boolean;
}
const DEFAULT: GameState = {
  xp: 0,
  days: {},
  goalMin: 10,
  recent: {},
  stars: {},
  unlocked: {},
  badges: {},
  challenges: { date: '', list: [], bonus: false },
  standards: {},
  streaks: {},
  fx: true
};
export const loadGame = (): GameState => load('jeu', DEFAULT);
const saveGame = (g: GameState) => save('jeu', g);

export const dayKey = (d: Date = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDaysKey = (key: string, n: number) => addDays(key, n);
function addDays(key: string, n: number) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
}

// ---------------------------------------------------------------- Série (jours d'affilée)

/**
 * Jours d'affilée où l'objectif est atteint (aujourd'hui compte s'il est atteint, sinon la série
 * d'hier tient encore). Un joker par semaine : un seul jour manqué n'interrompt pas la série.
 */
export function streakOf(g: GameState, today = dayKey()): { days: number; todayDone: boolean; jokerUsed: boolean } {
  const goalMs = g.goalMin * 60000;
  const done = (k: string) => (g.days[k]?.ms ?? 0) >= goalMs;
  const todayDone = done(today);
  let n = todayDone ? 1 : 0;
  let k = addDays(today, -1);
  let lastJoker = -99;
  let jokerUsed = false;
  for (let i = 1; i < 3650; i++, k = addDays(k, -1)) {
    if (done(k)) {
      n++;
      continue;
    }
    // Joker : un trou d'un seul jour, au plus un par période de 7 jours.
    if (n > 0 && done(addDays(k, -1)) && i - lastJoker >= 7) {
      lastJoker = i;
      jokerUsed = true;
      continue;
    }
    break;
  }
  return { days: n, todayDone, jokerUsed };
}

// ---------------------------------------------------------------- Badges

export interface Badge {
  id: string;
  name: string;
  desc: string;
}
export const BADGES: Badge[] = [
  { id: 'premiers-pas', name: 'Premiers pas', desc: 'Une première bonne réponse' },
  { id: 'objectif', name: 'Objectif atteint', desc: 'L’objectif du jour, une première fois' },
  { id: 'serie-3', name: 'Trois jours', desc: '3 jours d’affilée' },
  { id: 'serie-7', name: 'Une semaine', desc: '7 jours d’affilée' },
  { id: 'serie-30', name: 'Un mois', desc: '30 jours d’affilée' },
  { id: 'etoile', name: 'Première étoile', desc: '80 % sur 20 réponses d’un niveau' },
  { id: 'etoiles-10', name: 'Constellation', desc: '10 étoiles' },
  { id: 'trois-etoiles', name: 'Sans faute', desc: '★★★ à un niveau (97 % sur 20 réponses)' },
  { id: 'defis', name: 'Défis relevés', desc: 'Les 3 défis d’une journée' },
  { id: 'oreille-20', name: 'Oreille d’or', desc: '20 bonnes réponses d’affilée à l’oreille' },
  { id: 'accord-entier', name: 'Oreille relative', desc: '10 accords entiers d’affilée' },
  { id: 'metronome', name: 'Métronome humain', desc: 'Tenir le tempo seul (niveau 5) à 90 %' },
  { id: 'clave', name: 'Clave', desc: 'Une clave tapée sans faute (Lire et taper, niveau 6)' },
  { id: 'analyste', name: 'Analyste', desc: 'Un morceau analysé à 100 %' },
  { id: 'standard', name: 'Premier standard', desc: 'Un standard validé : analyse, guide tones, comping' },
  { id: 'repertoire-5', name: 'Répertoire', desc: '5 standards validés' },
  { id: 'cours', name: 'Théoricien', desc: 'Toutes les leçons lues' },
  { id: 'confusion', name: 'Démêlé', desc: 'Une paire de confusions vaincue' },
  { id: 'voicings-20', name: 'Main gauche', desc: '20 voicings justes au micro d’affilée' },
  { id: 'grade-sideman', name: 'Sideman', desc: 'Grade Sideman (5 000 points)' },
  { id: 'grade-soliste', name: 'Soliste', desc: 'Grade Soliste (35 000 points)' }
];

// ---------------------------------------------------------------- Récompenses (pour les toasts)

export type Reward =
  | { kind: 'star'; exo: string; level: number; stars: number }
  | { kind: 'unlock'; exo: string; level: number }
  | { kind: 'badge'; badge: Badge }
  | { kind: 'challenge'; text: string; xp: number }
  | { kind: 'goal' }
  | { kind: 'grade'; name: string };
const listeners = new Set<(r: Reward) => void>();
export const onReward = (f: (r: Reward) => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
const changeListeners = new Set<() => void>();
/** Pour les écrans qui affichent l'état du jeu (accueil, progression). */
export const onGameChange = (f: () => void) => {
  changeListeners.add(f);
  return () => changeListeners.delete(f);
};

// ---------------------------------------------------------------- Événements

export type GameEvent =
  /** Une réponse (ok / faux), temps passé (ms, plafonné), exercice et niveau (index 0). */
  | { type: 'answer'; exo: string; level: number; ok: boolean; ms: number; duel?: boolean }
  | { type: 'lesson'; id: string; all: boolean }
  | { type: 'analyse'; chart: string; found: number; total: number; bad: number }
  | { type: 'listen'; chart: string; mode: 'analyse' | 'guide' | 'gammes'; ratio: number; chords: number }
  | { type: 'tempo'; level: number; ratio: number }
  | { type: 'confusionGone' };

const XP_CHALLENGE = 60;
const XP_ALL_CHALLENGES = 100;
const XP_GOAL = 50;

/** Applique un événement à un état (fonction pure, testable) ; renvoie les récompenses gagnées. */
export function apply(g: GameState, ev: GameEvent, today = dayKey()): Reward[] {
  const rewards: Reward[] = [];
  const day = (g.days[today] ??= { xp: 0, ms: 0 });
  const goalMs = g.goalMin * 60000;
  const wasGoal = day.ms >= goalMs;
  const gradeBefore = gradeOf(g.xp).index;
  const gain = (n: number) => {
    g.xp += n;
    day.xp += n;
  };
  const badge = (id: string) => {
    if (g.badges[id]) return;
    const b = BADGES.find((x) => x.id === id);
    if (!b) return;
    g.badges[id] = Date.now();
    rewards.push({ kind: 'badge', badge: b });
  };
  ensureChallenges(g, today);

  if (ev.type === 'answer') {
    day.ms += Math.min(ev.ms, 30000);
    if (ev.ok) gain(2 + ev.level);
    if (ev.ok) badge('premiers-pas');
    // Étoiles : réussite sur les 20 dernières réponses du niveau.
    const key = `${ev.exo}:${ev.level}`;
    const r = (g.recent[key] = [...(g.recent[key] ?? []), ev.ok ? 1 : 0].slice(-WINDOW));
    if (r.length >= WINDOW && !ev.duel) {
      const s = starsFor(r.reduce((a, b) => a + b, 0) / r.length);
      if (s > (g.stars[key] ?? 0)) {
        g.stars[key] = s;
        gain(25 * s);
        rewards.push({ kind: 'star', exo: ev.exo, level: ev.level, stars: s });
        badge('etoile');
        if (s === 3) badge('trois-etoiles');
        if (Object.values(g.stars).reduce((a, b) => a + b, 0) >= 10) badge('etoiles-10');
        const max = EXOS[ev.exo]?.levels ?? 1;
        if (ev.level + 1 < max && (g.unlocked[ev.exo] ?? 0) < ev.level + 1) {
          g.unlocked[ev.exo] = ev.level + 1;
          rewards.push({ kind: 'unlock', exo: ev.exo, level: ev.level + 1 });
        }
      }
    }
    // Séries de bonnes réponses.
    const st = (g.streaks[ev.exo] = ev.ok ? (g.streaks[ev.exo] ?? 0) + 1 : 0);
    if (ev.exo.startsWith('oreille') && st >= 20) badge('oreille-20');
    if (ev.exo === 'oreille-full' && st >= 10) badge('accord-entier');
    if (ev.exo === 'flash' && st >= 20) badge('voicings-20');
    if (ev.exo === 'rythme-taper' && ev.level === 5 && ev.ok) badge('clave');
    progress(g, (c) => (c.kind === 'answers' && ev.ok && (!c.exo || ev.exo.startsWith(c.exo))) || (c.kind === 'duel' && ev.ok && !!ev.duel), rewards, gain);
  } else if (ev.type === 'lesson') {
    day.ms += 3 * 60000;
    gain(20);
    if (ev.all) badge('cours');
    progress(g, (c) => c.kind === 'lesson', rewards, gain);
  } else if (ev.type === 'analyse') {
    day.ms += 4 * 60000;
    gain(10 * ev.found);
    if (ev.total > 0 && ev.found === ev.total && ev.bad === 0) {
      badge('analyste');
      standard(g, ev.chart, 'analyse', rewards, badge);
    }
    progress(g, (c) => c.kind === 'analyse', rewards, gain);
  } else if (ev.type === 'listen') {
    day.ms += Math.min(10, ev.chords) * 4000;
    if (ev.chords >= 12) {
      if (ev.mode === 'guide' && ev.ratio >= 0.8) standard(g, ev.chart, 'guide', rewards, badge);
      if (ev.mode === 'analyse' && ev.ratio >= 0.9) standard(g, ev.chart, 'comp', rewards, badge);
    }
  } else if (ev.type === 'tempo') {
    if (ev.level === 4 && ev.ratio >= 0.9) badge('metronome');
    if (ev.ratio >= 0.9) progress(g, (c) => c.kind === 'tempo', rewards, gain);
  } else if (ev.type === 'confusionGone') {
    badge('confusion');
  }

  if (!wasGoal && day.ms >= goalMs) {
    gain(XP_GOAL);
    rewards.push({ kind: 'goal' });
    badge('objectif');
    const s = streakOf(g, today).days;
    if (s >= 3) badge('serie-3');
    if (s >= 7) badge('serie-7');
    if (s >= 30) badge('serie-30');
  }
  const gradeAfter = gradeOf(g.xp);
  if (gradeAfter.index > gradeBefore) {
    rewards.push({ kind: 'grade', name: gradeAfter.name });
    if (gradeAfter.index >= 2) badge('grade-sideman');
    if (gradeAfter.index >= 4) badge('grade-soliste');
  }
  return rewards;
}

function standard(g: GameState, chart: string, part: 'analyse' | 'guide' | 'comp', rewards: Reward[], badge: (id: string) => void) {
  const s = (g.standards[chart] ??= {});
  if (s[part]) return;
  s[part] = true;
  if (s.analyse && s.guide && s.comp) {
    badge('standard');
    if (Object.values(g.standards).filter((x) => x.analyse && x.guide && x.comp).length >= 5) badge('repertoire-5');
  }
}

function progress(g: GameState, match: (c: Challenge) => boolean, rewards: Reward[], gain: (n: number) => void) {
  for (const c of g.challenges.list) {
    if (c.done >= c.goal || !match(c)) continue;
    c.done++;
    if (c.done === c.goal) {
      gain(XP_CHALLENGE);
      rewards.push({ kind: 'challenge', text: c.text, xp: XP_CHALLENGE });
    }
  }
  if (!g.challenges.bonus && g.challenges.list.length && g.challenges.list.every((c) => c.done >= c.goal)) {
    g.challenges.bonus = true;
    gain(XP_ALL_CHALLENGES);
    const b = BADGES.find((x) => x.id === 'defis')!;
    if (!g.badges.defis) {
      g.badges.defis = Date.now();
      rewards.push({ kind: 'badge', badge: b });
    }
  }
}

// ---------------------------------------------------------------- Défis du jour

/** Pistes pour les défis, fournies par l'appli (points faibles, confusions, leçons non lues…). */
export interface ChallengeHints {
  weakExo?: { exo: string; name: string; href: string };
  duel?: { text: string; href: string };
  lessonLeft?: boolean;
  chart?: { title: string; href: string };
}
let hintsProvider: () => ChallengeHints = () => ({});
export const setChallengeHints = (f: () => ChallengeHints) => (hintsProvider = f);

/** Graine stable pour le jour : les défis ne changent pas en cours de journée. */
const seedOf = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function makeChallenges(today: string, h: ChallengeHints): Challenge[] {
  const seed = seedOf(today);
  const out: Challenge[] = [];
  const exos = ['tonalite', 'express', 'oreille', 'lecture'];
  const exo = h.weakExo ?? { exo: exos[seed % exos.length], name: EXOS[exos[seed % exos.length]]?.name ?? 'Oreille', href: `#/${exos[seed % exos.length]}` };
  out.push({ id: 'answers', text: `${exo.name} : 20 bonnes réponses`, kind: 'answers', exo: exo.exo, goal: 20, done: 0, href: exo.href });
  if (h.duel) out.push({ id: 'duel', text: `${h.duel.text} : 10 duels gagnés`, kind: 'duel', goal: 10, done: 0, href: h.duel.href });
  else out.push({ id: 'tempo', text: 'Rythme : tenir le tempo à 90 % (une fois)', kind: 'tempo', goal: 1, done: 0, href: '#/rythme/tempo' });
  if (h.lessonLeft && seed % 2 === 0) out.push({ id: 'lesson', text: 'Lire une leçon', kind: 'lesson', goal: 1, done: 0, href: '#/cours' });
  else out.push({ id: 'analyse', text: h.chart ? `Analyser ${h.chart.title}` : 'Analyser un morceau', kind: 'analyse', goal: 1, done: 0, href: h.chart?.href ?? '#/grilles' });
  return out;
}

function ensureChallenges(g: GameState, today: string) {
  if (g.challenges.date === today) return;
  g.challenges = { date: today, list: makeChallenges(today, hintsProvider()), bonus: false };
}

// ---------------------------------------------------------------- API pour l'appli

/** Enregistre un événement, sauvegarde, et annonce les récompenses. */
export function report(ev: GameEvent): Reward[] {
  const g = loadGame();
  const rewards = apply(g, ev);
  saveGame(g);
  rewards.forEach((r) => listeners.forEach((f) => f(r)));
  changeListeners.forEach((f) => f());
  return rewards;
}

/** L'état du jour (défis générés si besoin), pour l'accueil. */
export function gameToday(): GameState {
  const g = loadGame();
  const today = dayKey();
  if (g.challenges.date !== today) {
    ensureChallenges(g, today);
    saveGame(g);
  }
  return g;
}

export function setGoal(min: number) {
  const g = loadGame();
  g.goalMin = min;
  saveGame(g);
  changeListeners.forEach((f) => f());
}
export function setFx(on: boolean) {
  const g = loadGame();
  g.fx = on;
  saveGame(g);
  changeListeners.forEach((f) => f());
}

/** Plus haut niveau ouvert (au moins celui déjà choisi auparavant : rien ne se referme). */
export function unlockedMax(exo: string, alreadyUsed = 0): number {
  const g = loadGame();
  return Math.max(g.unlocked[exo] ?? 0, alreadyUsed);
}
/** Ouvre un niveau à la main (« Débloquer quand même »). */
export function unlock(exo: string, level: number) {
  const g = loadGame();
  g.unlocked[exo] = Math.max(g.unlocked[exo] ?? 0, level);
  saveGame(g);
  changeListeners.forEach((f) => f());
}
export const starsOf = (exo: string, level: number) => loadGame().stars[`${exo}:${level}`] ?? 0;
