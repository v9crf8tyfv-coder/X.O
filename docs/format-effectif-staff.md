# Format de la liste « Effectif du staff »

Message maintenu **automatiquement** par le bot (mis à jour à chaque changement de
rôle / absence). Sert aussi de base à la liste affichée sur le site (Gestion Staff).

## Rendu cible (d'après capture de référence)

```
Effectif du staff              ← titre souligné

🅰️ Administrateur (2) :         ← <emoji rôle> Grade (total actifs+absents) :
Aeloxiz                        ← membres ACTIFS, séparés par ", "
⏰ Absent : PouleCoquin         ← membres EN ABSENCE, séparés par ", "

🆂 Super-Modérateur (5) :
vava5t, Noctali, Zltoa
⏰ Absent : JeHealHule, Raphaelguess

Ⓜ️ Modérateur-Plus (5) :
Orionyx84, helhar, Matixxx
⏰ Absent : MistDark61, MrEnderman12

Ⓜ️ Modérateur-Réserviste (2) :
Jazz81
⏰ Absent : ixtazzking

🅶 Guide (3) :
---                            ← "---" quand aucun actif
⏰ Absent : LeMoustique, RLMI, Roitortue

🅱️ Builder (5) :
Azerayy, Kitel, Lens
⏰ Absent : Enderman, MistDark61   ← en italique = ? (absence longue à confirmer)
```

## Règles

- **(total)** = nombre d'actifs + nombre d'absents pour ce grade.
- Ligne des actifs : pseudos séparés par `, ` ; si aucun actif → `---`.
- Ligne absents : préfixe `⏰ Absent :` ; masquée si personne n'est absent (à confirmer).
- Ordre des grades : du plus haut au plus bas (hiérarchie).
- Un membre en absence passe de la ligne actifs à la ligne absents (cf. système d'absence).

## À confirmer avec le proprio du serveur

- IDs de rôles Discord + couleurs pour : Administrateur, Super-Modérateur,
  Modérateur-Plus, Modérateur-Réserviste, Guide, Builder.
- Sens de l'*italique* sur un pseudo absent (Builder → MistDark61).
- Faut-il afficher la ligne « Absent » même quand elle est vide ?
- Emojis exacts de chaque grade (icônes de rôle).
