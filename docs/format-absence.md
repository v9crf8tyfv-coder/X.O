# Format du système d'absence (référence)

Screenshots de référence issus d'un bot NationsGlory (modèle à reproduire pour X.O).

## Embed « Nouvelle absence »

Titre : `📅 Nouvelle absence`
Thumbnail : **PAS** la tête de skin NationsGlory. → logo du serveur X.O (à venir),
l'avatar Discord du staff, ou aucun thumbnail. À trancher quand le logo sera prêt.

Champs (chacun préfixé d'un emoji) :

```
👤 Pseudo : ixtazzking (0j)          ← (Xj) = durée/jours (à confirmer : restants ?)
📅 Début : 01/08/2026
📅 Fin :   06/08/2026
📊 Statut : ❌ Terminé   |  ⏳ En cours...
📝 Raison : Prolongement, j'ai bsn de respirer
—> Toujours la pour des shorts si besoin   ← ligne libre optionnelle
📦 Archivée                                  ← ajouté seulement une fois archivée
```

## Couleur de la barre latérale

- **En cours** → barre **verte**
- **Terminé / Archivée** → barre **rouge/orange**

## Boutons (sur une absence active, salon `absences`)

- `Archiver`  (bouton neutre/gris)  → passe en Terminé + déplace dans `archives absence`
- `Supprimer` (bouton rouge)        → supprime l'absence
- `Modifier`  (bouton bleu)         → ouvre un modal pour éditer les champs

Une fois **archivée** : message reposté dans le salon `archives absence`,
statut `❌ Terminé`, mention `📦 Archivée`, barre rouge, **plus aucun bouton**.

## Flux

1. Un staff pose une absence (bouton "poser une absence" → modal : début, fin, raison).
2. Embed posté dans `absences` (barre verte, ⏳ En cours, boutons Archiver/Supprimer/Modifier).
3. Le staff passe "en absence" dans l'Effectif du staff (cf. format-effectif-staff.md).
4. `Archiver` → embed déplacé dans `archives absence` (barre rouge, ❌ Terminé, 📦 Archivée),
   le staff repasse actif dans l'Effectif.

## À confirmer

- Signification exacte de `(0j)` / `(1j)` après le pseudo (jours restants ? durée ?).
- Qui peut archiver/supprimer/modifier (le staff lui-même ? les admins+ ?).
- L'archivage se fait-il aussi automatiquement à la date de fin ?
