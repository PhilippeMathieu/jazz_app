// « À travailler » : points faibles et exercices pas encore abordés, tirés des statistiques enregistrées.
import { load } from './storage';
import { QUALITIES } from './theory/chords';
import { PROGRESSIONS } from './theory/progressions';

export interface Advice {
  text: string;
  detail: string;
  href: string;
}
type Tally = Record<string, { c: number; t: number; ms?: number }>;

const TYPE_LABEL: Record<string, string> = {
  degree: 'degrés',
  pattern: 'enchaînements',
  key: 'tonalités',
  nine: '9 ou ♭9',
  tone: '3ces et 7es',
  scale: 'gammes'
};
const pct = (x: { c: number; t: number }) => Math.round((x.c / x.t) * 100);

export function advice(): Advice[] {
  const weak: (Advice & { score: number })[] = [];
  const express = load('express', { byType: {} as Tally, byTemplate: {} as Tally });
  const oreille = load('oreille', { items: {} as Tally });
  const flash = load('flash-stats', { chords: {} as Tally });
  const quiz = load('quiz', { c: 0, t: 0 });

  for (const [k, v] of Object.entries(express.byType))
    if (v.t >= 5 && v.c / v.t < 0.8) weak.push({ text: `Analyse express · ${TYPE_LABEL[k] ?? k}`, detail: `${pct(v)} % de réussite`, href: '#/express', score: v.c / v.t });
  for (const [k, v] of Object.entries(express.byTemplate))
    if (v.t >= 4 && v.c / v.t < 0.75 && PROGRESSIONS[k])
      weak.push({ text: `Analyse express · ${PROGRESSIONS[k].name}`, detail: `${pct(v)} % de réussite`, href: '#/express', score: v.c / v.t });
  for (const [k, v] of Object.entries(oreille.items)) {
    if (v.t < 4 || v.c / v.t >= 0.75) continue;
    const [mode, id] = k.split(':');
    const name = mode === 'prog' ? PROGRESSIONS[id]?.name : QUALITIES[id]?.sym;
    if (!name) continue;
    const what = mode === 'prog' ? 'progression' : mode === 'build' ? 'construire' : 'accord';
    weak.push({ text: `Oreille · ${what} ${name}`, detail: `${pct(v)} % de réussite`, href: '#/oreille', score: v.c / v.t });
  }
  for (const [k, v] of Object.entries(flash.chords)) {
    if (v.t < 3) continue;
    const acc = v.c / v.t;
    const avg = (v.ms ?? 0) / Math.max(1, v.c);
    if (acc < 0.7 || avg > 5000) weak.push({ text: `Flash voicings · ${k}`, detail: acc < 0.7 ? `${pct(v)} % justes` : `${(avg / 1000).toFixed(1).replace('.', ',')} s en moyenne`, href: '#/flash', score: acc * 0.9 });
  }
  if (quiz.t >= 8 && quiz.c / quiz.t < 0.8) weak.push({ text: 'Quiz d’analyse sur les grilles', detail: `${pct(quiz)} % de réussite`, href: '#/grilles', score: quiz.c / quiz.t });
  weak.sort((a, b) => a.score - b.score);

  const out: Advice[] = weak.slice(0, 3);
  // Pas encore abordé
  const todo: Advice[] = [];
  if (!Object.keys(express.byType).length) todo.push({ text: 'Analyse express, niveau 1', detail: 'Degrés et ii–V–I, en sprint de 60 s', href: '#/express' });
  if (!quiz.t) todo.push({ text: 'Quiz d’analyse sur Autumn Leaves', detail: 'Masque les degrés et retrouve-les', href: '#/grille/autumn-leaves' });
  if (!Object.keys(flash.chords).length) todo.push({ text: 'Flash voicings au piano', detail: 'Shells en ii–V–I, avec le micro', href: '#/flash' });
  if (!Object.keys(oreille.items).length) todo.push({ text: 'Oreille : reconnaître maj7, m7, 7', detail: 'Avec écouteurs', href: '#/oreille' });
  return [...out, ...todo].slice(0, 3);
}
