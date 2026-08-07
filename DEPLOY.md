# Déploiement du bot X.O (24h/24, gratuit)

Le bot doit tourner en permanence sur un hébergeur. Vercel ne peut pas (serverless).
Ce guide couvre deux hébergeurs **gratuits**. Choisis-en un.

## Variables d'environnement à configurer sur l'hébergeur

Peu importe l'hébergeur, mets ces variables (les mêmes que ton `.env`) :

| Variable | Valeur |
|---|---|
| `DISCORD_TOKEN` | le token du bot X.O |
| `DISCORD_CLIENT_ID` | `1535376873595605163` |
| `DISCORD_GUILD_ID` | `1535229063537627136` |
| `DATABASE_URL` | l'URL Supabase (avec le mot de passe) |

⚠️ On ne commit **jamais** le `.env` — les secrets se mettent dans le panel de l'hébergeur.

---

## Option A — Bot-Hosting.net (panel, gratuit)

1. Va sur https://bot-hosting.net → **Login with Discord** (connexion avec ton compte Discord).
2. Récupère les "coins" gratuits (bouton Free coins) → **Create Server** → type **Node.js**.
3. Dans l'onglet **Startup** :
   - **Node version** : 22
   - **Startup command** : `npm run bot:start`
4. Onglet **Files** → importe le projet :
   - soit via **Git** : URL de ton repo GitHub (voir plus bas),
   - soit en uploadant un zip du dossier `xo-panel`.
5. Onglet **Startup / Variables** → ajoute les 4 variables ci-dessus.
6. Ouvre la **Console** → **Start**. Tu dois voir `✅ X.O connecté`.
7. Lance une fois le déploiement des commandes : dans la console, `npm run bot:deploy`
   (ou garde-le, c'est déjà fait sur ton serveur).

## Option B — Discloud (gratuit, via config)

Le fichier `discloud.config` est déjà prêt à la racine.

1. Va sur https://discloud.com → connecte-toi.
2. Installe l'app Discloud sur le serveur de support, ou utilise le site pour **upload**.
3. Zippe le dossier `xo-panel` (sans `node_modules` ni `.env`) et upload-le.
4. Dans le panel Discloud → **Variables d'environnement** → ajoute les 4 variables.
5. Démarre l'app.

---

## Repo GitHub (pour déployer depuis Git + partager entre devs)

Le dépôt git local est déjà initialisé et committé. Pour le mettre en privé sur GitHub :

1. Crée un dépôt **vide et privé** sur https://github.com/new (nom : `xo-panel`,
   **ne coche rien** — pas de README/gitignore).
2. Dans le terminal :
   ```bash
   cd ~/xo-panel
   git remote add origin https://github.com/TON_PSEUDO/xo-panel.git
   git branch -M main
   git push -u origin main
   ```
3. GitHub te demandera de t'authentifier (navigateur ou token) — c'est ta partie.
4. Pour ajouter d'autres devs : repo GitHub → **Settings → Collaborators** → invite-les.
   Tu restes **owner** (accès maître).
