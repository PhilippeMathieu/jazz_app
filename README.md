# Harmonie jazz

Appli web installable (PWA) pour progresser en harmonie jazz au piano, pensée pour l'iPhone.

## Piliers

1. **Lire et analyser** : grilles d'accords, chiffrage en degrés, ii–V–I, centres tonaux, substitutions.
2. **Improviser** : gamme par accord, guide tones, notes cibles, play-along.
3. **Entendre** : reconnaissance d'accords et de progressions à l'oreille.

Plus tard : rythme (comping, swing, rythme harmonique).

## Architecture

```
src/
  core/
    theory/     notes, intervalles, accords, gammes, orthographe
    chart/      modèle de grille (tonalité, mesures, accords, durées en temps)
    analysis/   moteur d'analyse (ii–V–I, subs, tonalités, degrés)
    player/     lecteur de grille (basse + comping, tempo)
  modules/
    analyse/
    impro/
    oreille/
  library/      grilles (accords uniquement) + import
```

Stack : TypeScript, Vite, Tone.js (piano échantillonné), service worker pour le hors ligne, déploiement GitHub Pages.

## Lots

1. Socle : PWA, son piano, modèle de grille, moteur d'analyse, lecteur, oreille v1.
2. Analyse : bibliothèque de grilles, exercices de chiffrage.
3. Impro : play-along, guide tones, exercices guidés.
4. Oreille : enrichissement.

## Installer sur iPhone

Ouvrir l'URL GitHub Pages dans Safari → Partager → « Sur l'écran d'accueil ».
