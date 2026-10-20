// « À travailler » : les deux points les plus faibles, tirés des statistiques enregistrées.
import { load } from './storage';
import { QUALITIES } from './theory/chords';
import { PROGRESSIONS } from './theory/progressions';
import { SECTIONS } from '../ui/sections';
import { confusions } from './confusions';
import { GROOVES, StyleId } from './rhythm/styles';
import { rhythmById } from './rhythm/patterns';

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
  const tonalite = load('tonalite', { byDeg: {} as Tally });
  const lecture = load('lecture', { byItem: {} as Tally });

  for (const [k, v] of Object.entries(express.byType))
    if (v.t >= 5 && v.c / v.t < 0.8) weak.push({ text: `${SECTIONS.express.title} · ${TYPE_LABEL[k] ?? k}`, detail: `${pct(v)} % de réussite`, href: '#/express', score: v.c / v.t });
  for (const [k, v] of Object.entries(express.byTemplate))
    if (v.t >= 4 && v.c / v.t < 0.75 && PROGRESSIONS[k])
      weak.push({ text: `${SECTIONS.express.title} · ${PROGRESSIONS[k].name}`, detail: `${pct(v)} % de réussite`, href: '#/express', score: v.c / v.t });
  for (const [k, v] of Object.entries(oreille.items)) {
    if (v.t < 4 || v.c / v.t >= 0.75) continue;
    const [mode, id] = k.split(':');
    const name = mode === 'prog' ? PROGRESSIONS[id]?.name : QUALITIES[id]?.sym;
    if (!name) continue;
    const what = mode === 'prog' ? 'progression' : mode === 'build' ? 'construire' : 'accord';
    weak.push({ text: `${SECTIONS.oreille.title} · ${what} ${name}`, detail: `${pct(v)} % de réussite`, href: '#/oreille', score: v.c / v.t });
  }
  for (const [k, v] of Object.entries(flash.chords)) {
    if (v.t < 3) continue;
    const acc = v.c / v.t;
    const avg = (v.ms ?? 0) / Math.max(1, v.c);
    if (acc < 0.7 || avg > 5000) weak.push({ text: `${SECTIONS.flash.title} · ${k}`, detail: acc < 0.7 ? `${pct(v)} % justes` : `${(avg / 1000).toFixed(1).replace('.', ',')} s en moyenne`, href: '#/flash', score: acc * 0.9 });
  }
  for (const [k, v] of Object.entries(tonalite.byDeg)) {
    if (v.t < 5) continue;
    const acc = v.c / v.t;
    const avg = (v.ms ?? 0) / v.t;
    const [mode, roman] = k.split(':');
    if (acc < 0.8 || avg > 3000)
      weak.push({
        text: `${SECTIONS.tonalite.title} · ${roman}${mode === 'm' ? ' en mineur' : mode === 'T' ? ' (3 sons)' : ''}`,
        detail: acc < 0.8 ? `${pct(v)} % de réussite` : `${(avg / 1000).toFixed(1).replace('.', ',')} s en moyenne`,
        href: '#/tonalite',
        score: acc * 0.95
      });
  }
  for (const clef of ['G', 'F']) {
    const v = Object.entries(lecture.byItem)
      .filter(([k]) => k.startsWith(clef + ':'))
      .reduce((s, [, x]) => ({ c: s.c + x.c, t: s.t + x.t, ms: s.ms + (x.ms ?? 0) }), { c: 0, t: 0, ms: 0 });
    if (v.t < 10) continue;
    const acc = v.c / v.t;
    const avg = v.ms / v.t;
    if (acc < 0.85 || avg > 2500)
      weak.push({
        text: `${SECTIONS.lecture.title} · ${clef === 'G' ? 'clé de sol' : 'clé de fa'}`,
        detail: acc < 0.85 ? `${pct(v)} % de réussite` : `${(avg / 1000).toFixed(1).replace('.', ',')} s par note`,
        href: '#/lecture',
        score: acc * 0.95
      });
  }
  if (quiz.t >= 8 && quiz.c / quiz.t < 0.8) weak.push({ text: `${SECTIONS.grilles.title} · Analyser`, detail: `${pct(quiz)} % de réussite`, href: '#/grilles', score: quiz.c / quiz.t });
  // Confusions : la paire la plus confondue de chaque exercice d'écoute.
  const qual = (k: string) => (k === 'maj' ? 'majeur' : k === 'min' ? 'mineur' : QUALITIES[k]?.sym ?? k);
  const conf: [string, string, (k: string) => string, string][] = [
    ['accord', SECTIONS.oreille.title, qual, '#/oreille/confusions'],
    ['prog', SECTIONS.oreille.title, (k) => PROGRESSIONS[k]?.name ?? k, '#/oreille/confusions'],
    ['degre', SECTIONS.oreille.title, (k) => k, '#/oreille/confusions'],
    ['style', SECTIONS.rythme.title, (k) => GROOVES[k as StyleId]?.name ?? k, '#/rythme/style/confusions'],
    ['rythme', SECTIONS.rythme.title, (k) => rhythmById(k)?.name ?? k, '#/rythme/oreille/confusions']
  ];
  for (const [d, section, name, href] of conf) {
    const p = confusions(d as 'accord')[0];
    if (p) weak.push({ text: `${section} · ${name(p.a)} ou ${name(p.b)} ?`, detail: `Confondus ${p.err} fois : à départager`, href, score: Math.max(0.2, 0.6 - p.score / 10) });
  }
  weak.sort((a, b) => a.score - b.score);

  return weak.slice(0, 2);
}
