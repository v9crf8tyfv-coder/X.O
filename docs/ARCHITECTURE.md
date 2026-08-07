# Architecture — comment TOUT se connecte (Discord + Site + IG)

Objectif : bot Discord, site web et serveur Minecraft (IG, à venir) doivent être
**synchronisés**. Un changement de grade quelque part se répercute partout, et **tout
est journalisé** (surveillance).

## Principe central : la base de données est la SOURCE DE VÉRITÉ

Tout passe par la base Supabase (Postgres). Chacun des 3 "mondes" lit/écrit dedans :

```
                        ┌───────────────────────┐
                        │   Supabase (Postgres)  │  ← source de vérité
                        │  staff, grades,        │
                        │  sanctions, absences,  │
                        │  surveillance_logs,    │
                        │  accounts, tickets,    │
                        │  pending_actions (*)   │
                        └──────────▲────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
   ┌────┴─────┐              ┌─────┴──────┐             ┌──────┴──────┐
   │  BOT X.O │              │   SITE     │             │  SERVEUR MC │
   │ discord.js│             │  Next.js   │             │   (IG, futur)│
   └────┬─────┘              └─────┬──────┘             └──────┬──────┘
        │ applique sur Discord      │ interface fonda/staff     │ plugin/API
        │ (rôles, salons, bans)     │ (Gestion Staff, Site…)    │ (rangs, perms)
        └───────────────┬───────────┴───────────────┬───────────┘
                        │  chacun LOG dans surveillance_logs (source: discord/site/ig)
```

## Le "grade" est le pivot

Un grade (cf. `packages/shared/src/grades.ts`) porte :
- une **couleur** + un **roleId Discord** → le bot ajoute/retire le rôle
- un **niveau** (hiérarchie) → accès site + qui surveille qui
- (à venir) un **rang IG** → le plugin MC applique les perms en jeu

Ainsi, changer le grade d'un staff = une seule écriture en base, répercutée sur les 3 mondes.

## Les 3 flux

### 1. Discord → base  ✅ (fait)
- `guildMemberUpdate` : tout ajout/retrait de rôle-grade est loggé dans le bon salon
  de surveillance (respo/admin/staff), **sauf** si l'auteur est fondateur.
- Commandes de sanction (`/ban`…) → écrites dans `sanctions`.

### 2. Site → base → Discord (+ IG futur)  🚧 (à câbler)
Quand un fonda modifie un grade sur le site, le bot doit **appliquer** le rôle Discord
(et plus tard le rang IG). Le bot n'a pas de serveur HTTP → on utilise une **file
d'actions** :

- Le site insère une ligne dans **`pending_actions`** (ex : `role.add`, `role.remove`,
  `sanction.cancel`, `ig.rank.set`) avec la cible (discord_id / pseudo) et le grade.
- Le bot **écoute** cette table (Supabase Realtime) ou la **sonde** toutes les X s,
  exécute l'action sur Discord, la marque `done`, et LOG dans `surveillance_logs`.
- (*) table `pending_actions` à ajouter au schéma quand on fait le site.

### 3. IG → base  🚧 (quand le serveur MC existera)
- Un plugin MC (ou l'API NationsGlory/LuckPerms) écrit sanctions/changements dans la base
  avec `source = 'ig'`.
- Le bot voit la nouvelle ligne (Realtime/poll) et LOG dans surveillance + met à jour
  l'effectif staff. Le site l'affiche (Gestion Sanctions).

## Surveillance = "tout est noté"
Table `surveillance_logs` avec `source` ∈ {discord, site, ig}. Chaque monde y écrit ses
actions. Règle constante : **les actions des fondateurs ne sont jamais loggées**.

## Ce qui reste à construire pour la connexion totale
1. Table `pending_actions` + écoute côté bot (Supabase Realtime).
2. Site (Next.js) qui lit/écrit la base et remplit `pending_actions`.
3. Effectif staff auto (message Discord auto-actualisé depuis la base).
4. Plugin/pont IG (quand le serveur MC sera prêt) : écrit `source='ig'`, lit les grades.

> Tant que ces briques ne sont pas là, chaque monde fonctionne déjà de son côté et LOG
> en base — la "colle" (pending_actions + realtime) est le prochain gros chantier avec le site.
