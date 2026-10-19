# Harmonie jazz

Appli web installable (PWA) pour progresser en harmonie jazz au piano, pensée pour l'iPhone.

Deux usages : **dans le métro** (sans piano, d'une main, hors ligne) et **au piano** (téléphone sur le pupitre, écran toujours allumé).

## Modules

1. **Lire et analyser** : grilles d'accords analysées (degrés, ii–V, centres tonaux, substitutions), play-along, transposition, import de grilles par copier-coller.
2. **Analyse express** : questions chronométrées sur des suites d'accords (degré, schéma, tonalité, 9 ou ♭9, 3ce/7e, gamme), sprint 60 s ou série de 20, records.
3. **Entendre** : reconnaissance d'accords et de progressions à l'oreille, construction au clavier.
4. **Improviser** : gamme de chaque accord déduite de l'analyse, lignes de guide tones, clavier qui suit le play-along, ii–V–I dans les 12 tonalités.
5. **Flash voicings** : un accord s'affiche, on le joue au piano, l'appli révèle et fait entendre le voicing (shell, sans fondamentale A/B). Mains libres.
6. **Mode pupitre** : plein écran lisible à distance (accord en cours, suivant, temps, gamme ou guide tones), depuis une grille ou Improviser.

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

1. ✅ Socle : PWA, son piano, modèle de grille, moteur d'analyse, lecteur, oreille.
2. ✅ Analyse express, import de grilles.
3. ✅ Improviser : gammes, guide tones, 12 tonalités.
4. À venir : écoute du jeu au micro, rythme, enrichissement de l'oreille.

## Installer sur iPhone

1. Ouvrir https://philippemathieu.github.io/jazz_app/ dans Safari.
2. Partager → « Sur l'écran d'accueil ».

L'appli fonctionne ensuite hors ligne.

## Développement

```bash
npm install
npm run dev      # serveur local
npm test         # tests de la théorie et du moteur d'analyse
npm run build    # build de production (dist/)
```

Chaque push sur `main` lance les tests, le build et le déploiement GitHub Pages.

## Format des grilles

```
title: Autumn Leaves
key: Gm
tempo: 132
style: swing        # swing | bossa | blues
level: 1
[A]
| Cm7 | F7 | B♭maj7 | E♭maj7 |
| Aø7 | D7♭9 | Gm6 | Gm6 |
```

Une mesure par cellule ; deux accords dans une cellule se partagent la mesure ; `%` répète la mesure précédente.

L'écran « Importer » accepte aussi du texte libre copié d'Ultimate Guitar ou d'une autre appli : lignes d'accords au-dessus des paroles, sections `[Verse]`, notations `C7M`, `G7(b9)`, `Bm7(b5)`, capo (accords ramenés à la hauteur réelle), lignes `Key:` et `Tuning:`, format brut `[ch]Am[/ch]` et ChordPro (`[Am7]paroles`, `{title:}`, `{key:}`). Sans barres de mesure, chaque accord occupe une mesure.

## Crédits

- Piano : Salamander Grand Piano V3 par Alexander Holm, licence CC BY 3.0.
- Polices : Big Shoulders Display, IBM Plex Sans et IBM Plex Mono (SIL Open Font License).
