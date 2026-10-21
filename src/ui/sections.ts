// Noms des rubriques, les mêmes partout : accueil, titres d'écran, « Continuer », conseils.
export type SectionId = 'cours' | 'clavier' | 'lecture' | 'tonalite' | 'express' | 'oreille' | 'rythme' | 'flash' | 'phrases' | 'grilles' | 'micro';

export interface Section {
  title: string;
  /** Ce qu'on y fait, en une ligne. */
  sub: string;
  /** Où : dans le métro (écran, écouteurs), au piano, ou les deux. */
  where?: 'Métro' | 'Piano' | 'Métro · piano';
}

export const SECTIONS: Record<SectionId, Section> = {
  cours: { title: 'Cours', sub: 'Les leçons, de 3 à 5 minutes' },
  clavier: { title: 'Clavier', sub: 'Voir, entendre et nommer n’importe quel accord' },
  lecture: { title: 'Notes', sub: 'Lire en clé de sol et en clé de fa', where: 'Métro · piano' },
  tonalite: { title: 'Accords', sub: 'Quel accord sur chaque note de la gamme', where: 'Métro' },
  express: { title: 'Enchaînements', sub: 'Degrés, ii–V–I : analyser vite', where: 'Métro' },
  oreille: { title: 'Oreille', sub: 'Intervalles, accords, suites, basse', where: 'Métro' },
  rythme: { title: 'Rythme', sub: 'Placement, tempo, styles', where: 'Métro · piano' },
  flash: { title: 'Voicings', sub: 'Jouer les accords, le micro valide', where: 'Piano' },
  phrases: { title: 'Phrases', sub: 'Vocabulaire sur ii–V–I, à rejouer', where: 'Piano' },
  grilles: { title: 'Morceaux', sub: 'Les standards, analysés et accompagnés', where: 'Piano' },
  micro: { title: 'Micro', sub: 'Tester et régler l’écoute du piano' }
};

/** Les exercices de l'accueil, par compétence. */
export const TRAINING: SectionId[] = ['lecture', 'tonalite', 'express', 'oreille', 'rythme', 'flash', 'phrases'];
