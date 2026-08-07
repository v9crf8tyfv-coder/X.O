# X.O Panel

Bot Discord **X.O** + site de gestion staff pour le serveur Minecraft.

## Structure (monorepo)

```
xo-panel/
├── apps/bot        → Bot Discord X.O (discord.js, TypeScript)
├── apps/web        → Site (Next.js) — à venir
├── packages/shared → Config partagée : rôles, salons, grades, couleurs
├── packages/db     → Base de données partagée (Postgres / Supabase)
└── docs/           → Formats de référence (absence, effectif staff…)
```

## Prérequis

- Node.js ≥ 20
- Un serveur Discord + une application bot ([Developer Portal](https://discord.com/developers/applications))
- (Optionnel au début) Un projet Supabase pour la base de données

## Mise en route (bot)

1. **Installer les dépendances** (à la racine) :
   ```bash
   npm install
   ```

2. **Configurer l'environnement** : copie `.env.example` en `.env` et remplis :
   - `DISCORD_TOKEN` (⚠️ reset-le d'abord sur le portail !)
   - `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`
   - `DATABASE_URL` (optionnel tant que Supabase n'est pas prêt)

3. **Base de données** (quand Supabase est prêt) : exécute
   `packages/db/schema.sql` dans Supabase → SQL Editor.

4. **Déployer les commandes slash** sur le serveur :
   ```bash
   npm run bot:deploy
   ```

5. **Lancer le bot** :
   ```bash
   npm run bot:dev     # développement (auto-reload)
   npm run bot:start   # production
   ```

## Fonctionnalités du bot (état actuel)

- ✅ Commandes de modération (fonda uniquement) : `/ban`, `/kick`, `/mute`, `/unmute`, `/warn`
- ✅ `/panel` : panneau de config du rôle auto-attribué à l'arrivée
- ✅ Surveillance des changements de rôles (log dans le bon salon, hors actions fonda)
- ✅ `/setup-absence` : panneau d'absence (modal début/fin/raison, boutons Archiver/Supprimer/Modifier, archivage auto dans le salon archives)
- ✅ `/setup-ticket` : panneaux de tickets staff & joueurs (menu de catégories, salon privé avec permissions par catégorie, embed persistant, bouton fermer)
- 🚧 Effectif du staff auto (message auto-actualisé) — à venir avec le site

## Commandes de setup (à lancer une fois, en tant que fonda)

| Commande | Effet |
|---|---|
| `/panel` | Poste le panneau de config du rôle auto |
| `/setup-absence` | Poste le panneau d'absence dans le salon absences |
| `/setup-ticket espace:staff` | Poste le panneau tickets dans le salon ticket staff |
| `/setup-ticket espace:normal` | Poste le panneau tickets dans le salon ticket normal |

## Sécurité

- Aucun secret dans le code : tout passe par `.env` (jamais commit, cf `.gitignore`).
- Mots de passe du site hashés (jamais en clair).
- Reset le token Discord dès qu'il a pu fuiter.
