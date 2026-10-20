// Rythmes à lire, taper et reconnaître. Positions en « ticks » : 12 par temps (croches, triolets, doubles croches).
export const TPB = 12;
export type Feel = 'straight' | 'swing';

export interface RPattern {
  id: string;
  name: string;
  level: number;
  /** Nombre de mesures (4 temps). */
  bars: number;
  /** Attaques, en ticks depuis le début du motif. */
  hits: number[];
  /** Motif en triolets : grille de 3 cases par temps. */
  triplet?: boolean;
  /** Se joue en croches droites (bossa, clave…) même si on est en swing. */
  straight?: boolean;
  hint: string;
}

const B = 48; // une mesure
const P = (id: string, name: string, level: number, hits: number[], hint: string, extra: Partial<RPattern> = {}): RPattern => ({
  id,
  name,
  level,
  bars: Math.max(1, Math.ceil((Math.max(...hits) + 1) / B)),
  hits,
  hint,
  ...extra
});

export const RHYTHM_LEVELS = [
  { label: 'Noires', desc: 'Sur les temps : compter 1, 2, 3, 4' },
  { label: 'Croches', desc: 'Le « et » entre les temps, en croches ternaires (swing)' },
  { label: 'Contretemps', desc: 'Sur les « et » : Charleston, contretemps de 2 et 4' },
  { label: 'Comping', desc: 'Motifs de 2 mesures, anticipations sur le « et » de 4' },
  { label: 'Triolets', desc: 'Trois notes par temps, triolet de noires' },
  { label: 'Claves', desc: 'Son, rumba, bossa : motifs latins en croches droites' }
];

export const RHYTHMS: RPattern[] = [
  P('n-4', 'Les 4 temps', 0, [0, 12, 24, 36], 'Une attaque par temps : 1, 2, 3, 4.'),
  P('n-13', '1 et 3', 0, [0, 24], 'Les temps forts.'),
  P('n-24', '2 et 4', 0, [12, 36], 'Les temps faibles, ceux du charleston en jazz.'),
  P('n-123', '1, 2, 3', 0, [0, 12, 24], 'Silence sur le 4.'),
  P('n-134', '1, 3, 4', 0, [0, 24, 36], 'Silence sur le 2.'),

  P('c-1e2', '1 et 2, 3', 1, [0, 6, 12, 24], 'Deux croches sur le 1 : la 2e est courte en swing.'),
  P('c-12e', '1, 2 et, 3', 1, [0, 12, 18, 24], 'Deux croches sur le 2.'),
  P('c-all', 'Toutes les croches', 1, [0, 6, 12, 18, 24, 30, 36, 42], 'Longue, courte, longue, courte : le swing.'),
  P('c-3e4', '1, 3 et 4', 1, [0, 24, 30, 36], 'Deux croches sur le 3.'),
  P('c-1e3e', '1 et, 3 et', 1, [0, 6, 24, 30], 'Deux croches sur 1 et sur 3.'),

  P('s-charleston', 'Charleston', 2, [0, 18], 'Le 1, puis le « et » de 2 : le rythme de comping le plus joué.'),
  P('s-24e', 'Contretemps de 2 et de 4', 2, [18, 42], 'Sur le « et » de 2 et le « et » de 4.'),
  P('s-alle', 'Tous les contretemps', 2, [6, 18, 30, 42], 'Uniquement les « et ».'),
  P('s-e1-3', '« Et » de 1, puis 3', 2, [6, 24], 'Commence juste après le temps.'),
  P('s-1e24', '1, « et » de 2, 4', 2, [0, 18, 36], 'Charleston prolongé.'),

  P('p-charl2', 'Charleston sur 2 mesures', 3, [0, 18, 48, 66], 'Le même motif, deux fois.'),
  P('p-ant4', 'Anticipation : le « et » de 4', 3, [0, 42, 72], 'L’accord suivant arrive une croche en avance, sur le « et » de 4.'),
  P('p-charl-ant', 'Charleston et anticipation', 3, [0, 18, 42, 66], 'Charleston, puis l’accord de la mesure 2 anticipé.'),
  P('p-epars', 'Comping clairsemé', 3, [6, 36, 54, 90], 'Peu de notes, bien placées : la marque des bons accompagnateurs.'),
  P('p-e2-4', 'Contretemps et 4', 3, [18, 36, 66, 90], 'Alterne contretemps et temps.'),

  P('t-12', 'Triolets sur 1 et 2', 4, [0, 4, 8, 12, 16, 20, 24, 36], 'Trois notes égales par temps.', { triplet: true }),
  P('t-noires', 'Triolet de noires', 4, [0, 8, 16, 24, 36], 'Trois notes égales sur deux temps : « 3 pour 2 ».', { triplet: true }),
  P('t-let', 'Le 3e triolet de chaque temps', 4, [8, 20, 32, 44], 'La dernière note du triolet : c’est la croche courte du swing.', { triplet: true }),
  P('t-1let2', '1 et le 3e triolet du 2', 4, [0, 20, 24, 44], 'Placement typique d’une note anticipée en swing.', { triplet: true }),

  P('k-son32', 'Clave de son 3-2', 5, [0, 18, 36, 60, 72], '3 coups (1, « et » de 2, 4), puis 2 coups (2, 3).', { straight: true }),
  P('k-son23', 'Clave de son 2-3', 5, [12, 24, 48, 66, 84], 'Les deux mesures inversées : 2 coups, puis 3.', { straight: true }),
  P('k-rumba32', 'Clave de rumba 3-2', 5, [0, 18, 42, 60, 72], 'Comme le son, mais le 3e coup glisse sur le « et » de 4.', { straight: true }),
  P('k-bossa', 'Clave de bossa nova', 5, [0, 18, 36, 60, 78], 'Comme le son 3-2, mais le dernier coup sur le « et » de 3.', { straight: true })
];

export const rhythmById = (id: string) => RHYTHMS.find((r) => r.id === id);
export const rhythmsOf = (level: number) => RHYTHMS.filter((r) => r.level === level);

/** Place de la croche « et » dans le temps, selon le tempo (le swing se resserre quand ça va vite). */
export function swingRatio(tempo: number): number {
  if (tempo >= 230) return 0.58;
  if (tempo >= 180) return 0.62;
  return 2 / 3;
}

/** Position d'un tick en temps (nombre de noires depuis le début), swing compris. */
export function tickToBeat(tick: number, feel: Feel, tempo: number, p?: RPattern): number {
  const beat = Math.floor(tick / TPB);
  const within = tick - beat * TPB;
  if (within === 6 && feel === 'swing' && !p?.triplet && !p?.straight) return beat + swingRatio(tempo);
  return beat + within / TPB;
}

/** Cases d'affichage : 2 par temps (croches) ou 3 (triolets), avec le compte à dire. */
export function gridOf(p: RPattern): { tick: number; label: string; beat: boolean; on: boolean }[] {
  const per = p.triplet ? 3 : 2;
  const step = TPB / per;
  const cells: { tick: number; label: string; beat: boolean; on: boolean }[] = [];
  for (let t = 0; t < p.bars * B; t += step) {
    const within = t % TPB;
    const beatNo = Math.floor((t % B) / TPB) + 1;
    const label = within === 0 ? String(beatNo) : p.triplet ? '·' : 'et';
    cells.push({ tick: t, label, beat: within === 0, on: p.hits.includes(t) });
  }
  return cells;
}

/** Le motif en mots : « 1, et de 2, 4 ». */
export function countOf(p: RPattern): string {
  const name = (t: number) => {
    const beatNo = Math.floor((t % B) / TPB) + 1;
    const within = t % TPB;
    if (within === 0) return String(beatNo);
    if (within === 6) return `et de ${beatNo}`;
    return `${beatNo}+${within === 4 ? '⅓' : '⅔'}`;
  };
  if (p.bars === 1) return p.hits.map(name).join(', ');
  return Array.from({ length: p.bars }, (_, b) => {
    const h = p.hits.filter((t) => Math.floor(t / B) === b);
    return `mesure ${b + 1} : ${h.length ? h.map(name).join(', ') : 'rien'}`;
  }).join(' ; ');
}
