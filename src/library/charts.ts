import { Chart, parseChart } from '../core/chart/model';
import { EXERCISES } from './exercises';
import { userCharts } from './userCharts';

// Grilles d'accords uniquement (pas de mélodies). Format : voir parseChart.
const SOURCES: Record<string, string> = {
  'blues-f': `
title: Blues en F
subtitle: Blues jazz, 12 mesures
key: F
tempo: 120
style: blues
level: 1
notes: La forme la plus jouée en jam. I7 et IV7 sont des couleurs blues, puis ii–V vers le ii et turnaround.
[A]
| F7 | B♭7 | F7 | Cm7 F7 |
| B♭7 | B°7 | F7 | Am7 D7 |
| Gm7 | C7 | F7 D7 | Gm7 C7 |
`,
  'autumn-leaves': `
title: Autumn Leaves
subtitle: Standard, forme AAB, 32 mesures
key: Gm
tempo: 132
style: swing
level: 1
notes: Le meilleur standard pour apprendre : un ii–V–I majeur (B♭) puis un ii–V–i mineur (Gm), en boucle.
[A]
| Cm7 | F7 | B♭maj7 | E♭maj7 |
| Aø7 | D7♭9 | Gm6 | Gm6 |
| Cm7 | F7 | B♭maj7 | E♭maj7 |
| Aø7 | D7♭9 | Gm6 | Gm6 |
[B]
| Aø7 | D7♭9 | Gm6 | Gm6 |
| Cm7 | F7 | B♭maj7 | E♭maj7 |
| Aø7 | D7♭9 | Gm7 C7 | Fm7 B♭7 |
| E♭maj7 | Aø7 D7♭9 | Gm6 | Gm6 |
`,
  'blue-bossa': `
title: Blue Bossa
subtitle: Bossa nova, 16 mesures
key: Cm
tempo: 140
style: bossa
level: 2
notes: Tonalité mineure, puis une modulation d'un demi-ton vers D♭ majeur avec son propre ii–V–I.
[A]
| Cm7 | Cm7 | Fm7 | Fm7 |
| Dø7 | G7♭9 | Cm7 | Cm7 |
[B]
| E♭m7 | A♭7 | D♭maj7 | D♭maj7 |
| Dø7 | G7♭9 | Cm7 | Dø7 G7♭9 |
`,
  'rhythm-changes': `
title: Rhythm changes en B♭
subtitle: Forme AABA, 32 mesures
key: B♭
tempo: 160
style: swing
level: 2
notes: Turnarounds I–VI–ii–V dans les A, et un pont en cycle de dominantes (III7 VI7 II7 V7).
[A]
| B♭maj7 G7 | Cm7 F7 | B♭maj7 G7 | Cm7 F7 |
| Fm7 B♭7 | E♭maj7 A♭7 | Dm7 G7 | Cm7 F7 |
[A]
| B♭maj7 G7 | Cm7 F7 | B♭maj7 G7 | Cm7 F7 |
| Fm7 B♭7 | E♭maj7 A♭7 | Cm7 F7 | B♭6 |
[B]
| D7 | % | G7 | % |
| C7 | % | F7 | % |
[A]
| B♭maj7 G7 | Cm7 F7 | B♭maj7 G7 | Cm7 F7 |
| Fm7 B♭7 | E♭maj7 A♭7 | Cm7 F7 | B♭6 |
`,
  'all-the-things': `
title: All the Things You Are
subtitle: Standard, forme AABA', 36 mesures
key: A♭
tempo: 150
style: swing
level: 3
notes: Le standard des modulations : A♭, C, E♭, G, E, retour en A♭. Suis les ii–V pour savoir où tu es.
[A]
| Fm7 | B♭m7 | E♭7 | A♭maj7 |
| D♭maj7 | G7 | Cmaj7 | Cmaj7 |
[A2]
| Cm7 | Fm7 | B♭7 | E♭maj7 |
| A♭maj7 | Am7 D7 | Gmaj7 | Gmaj7 |
[B]
| Am7 | D7 | Gmaj7 | Gmaj7 |
| F♯m7 | B7 | Emaj7 | C7♯5 |
[A3]
| Fm7 | B♭m7 | E♭7 | A♭maj7 |
| D♭maj7 | D♭m7 G♭7 | Cm7 | B°7 |
| B♭m7 | E♭7 | A♭maj7 | Gø7 C7♭9 |
`
};

export const LIBRARY: Chart[] = Object.entries(SOURCES).map(([id, src]) => parseChart(src, id));

/** Cherche dans les standards, les exercices et les grilles importées. */
export const chartById = (id: string): Chart | undefined =>
  LIBRARY.find((c) => c.id === id) ?? EXERCISES.find((c) => c.id === id) ?? userCharts().find((c) => c.id === id);
