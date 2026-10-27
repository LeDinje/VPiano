# Piano Virtuel

Un piano jouable dans le navigateur avec un clavier AZERTY.

## Touches

| Rangée du clavier | Notes |
| --- | --- |
| `W X C V B N ,` | touches blanches, octave 3 (Do3 → Si3) |
| `S D G H J` | touches noires, octave 3 |
| `A Z E R T Y U I O P ^ $` | touches blanches, Do4 → Sol5 |
| `é " ( - è ç à =` | touches noires, octaves 4-5 |
| `Espace` (maintenu) | sustain |
| `←` / `→` | octave −1 / +1 |

## Charts

Sous le piano, l'éditeur de charts permet d'écrire un morceau avec les touches du clavier :

```
E E R T T R E Z
[WA] E T [VR] Y I
```

- touches séparées par des espaces (`ZXC` collé = Z puis X puis C) ;
- `[XC]` : touches à appuyer en même temps (affichées superposées) ;
- `.` : pause ;
- retour à la ligne : nouvelle ligne du chart.

**▶ Écouter** joue le chart au tempo choisi. **🎯 S'entraîner** surligne la prochaine touche
(sur le chart et sur le piano) et avance quand tu la joues.

Les charts d'exemple sont dans `EXAMPLE_CHARTS`, dans `script.js`.

## Ajouter ses sons

Dépose les fichiers dans `sounds/`, un fichier par note, nommés ainsi :

```
sounds/C4.mp3   sounds/Cs4.mp3   sounds/D4.mp3   sounds/Ds4.mp3 ...
```

Le dièse s'écrit `s` (`Cs4` = Do#4). Le format est réglé par `SOUND_EXT` dans `script.js`
(`.mp3` par défaut ; `.wav` ou `.ogg` marchent aussi).

Il n'est pas nécessaire d'avoir toutes les notes : une note manquante est jouée en transposant
l'échantillon le plus proche. Sans aucun fichier, un synthétiseur intégré prend le relais.

## Lancer en local

Les sons sont chargés via `fetch`, il faut donc un petit serveur (l'ouverture directe du fichier
`index.html` ne charge pas les sons) :

```
python3 -m http.server 8000
```

puis ouvrir http://localhost:8000.

## Mise en ligne

Le site est entièrement statique : il peut être publié tel quel avec GitHub Pages
(Settings → Pages → branche `main`, dossier racine).
