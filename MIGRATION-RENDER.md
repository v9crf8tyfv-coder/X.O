# Migration du panel : Vercel -> Render (gratuit, sans carte)

Objectif : sortir le panel web (`apps/web`) de Vercel (quota gratuit dépassé,
projet en pause) vers Render, en gardant tout gratuit et sans re-saisir les
variables à la main.

Tout le code est déjà prêt et poussé sur GitHub (`render.yaml` + port dynamique).
Il ne reste que des actions "clic" de ton côté, dans l'ordre.

---

## Ce qui est déjà fait (côté code)

- `render.yaml` a la racine : décrit le service web (build + start depuis la
  racine du monorepo pour résoudre `@xo/db` et `@xo/shared`, plan free).
- `apps/web` demarre sur le `PORT` que Render impose (`next start -p ${PORT:-3000}`).
- Build complet + écoute du PORT vérifiés en local : OK.

---

## Etape 1 — Créer le service sur Render

1. Aller sur https://render.com -> "Get Started" -> se connecter **avec GitHub**
   (aucune carte bancaire demandée sur le plan free).
2. Autoriser Render à voir le dépôt `v9crf8tyfv-coder/X.O`.
3. Dashboard -> "New +" -> **Blueprint**.
4. Choisir le dépôt `X.O`. Render lit automatiquement `render.yaml` et propose
   de créer le service **xo-panel-web**. Valider ("Apply").
5. Le premier build va tourner ~3-5 min. Il peut échouer à la fin UNIQUEMENT
   parce qu'il manque les variables d'environnement -> c'est normal, on les
   ajoute à l'étape 2, puis on relance.

## Etape 2 — Transférer les variables (zéro re-saisie)

Dans un terminal, sur ta machine, à la racine de `xo-panel` :

```bash
npx vercel login
```

```bash
npx vercel link
```

(choisir le projet `x-o-web` quand il demande)

```bash
npx vercel env pull .env.render --environment=production
```

Tu obtiens un fichier `.env.render` avec TOUTES les variables de prod.

Puis dans Render : service **xo-panel-web** -> onglet **Environment** ->
bouton **"Add from .env"** -> ouvrir `.env.render`, tout copier, coller dans
la zone, "Save". Render ré-déploie tout seul avec les variables.

> Important : supprime le fichier `.env.render` après (il contient les secrets).
> Il est déjà ignoré par git, mais ne le partage pas.

## Etape 3 — Vérifier

Quand le déploiement est "Live", Render te donne une URL du type
`https://xo-panel-web.onrender.com`. Ouvre-la : la page du site/panel doit
s'afficher et la connexion staff doit marcher.

> Plan free : le service s'endort après 15 min sans trafic et se réveille seul
> à la 1re requête (~30-60 s de cold start). Le mod ne sonde que quand il y a
> des joueurs connectés, donc serveur vide = service endormi = quota préservé.

## Etape 4 — Le domaine (recommandé : URL stable qu'on contrôle)

`x-o-web.vercel.app` est un sous-domaine **Vercel**, il ne peut pas suivre sur
Render. Deux choix :

- **Option A (recommandée)** : utiliser un sous-domaine de ton propre domaine,
  ex. `panel.emeria-site.com`. Avantage : si un jour on rechange d'hébergeur,
  on ne touche QUE le DNS, plus jamais le code.
  1. Render -> service -> "Settings" -> "Custom Domains" -> ajouter
     `panel.emeria-site.com`. Render affiche une cible CNAME.
  2. Chez ton registrar (DNS de `emeria-site.com`) : ajouter un enregistrement
     **CNAME** `panel` -> la cible donnée par Render.
  3. Attendre le certificat SSL (quelques minutes). URL finale :
     `https://panel.emeria-site.com`.

- **Option B (le plus simple)** : garder l'URL `xo-panel-web.onrender.com`
  telle quelle. Rien à configurer, mais l'URL change à chaque futur
  changement d'hébergeur.

## Etape 5 — Rebrancher les 6 références (je m'en occupe)

Dès que l'URL finale est connue et en ligne, **dis-moi laquelle**
(`panel.emeria-site.com` ou l'URL onrender). Je fais la bascule :

- EmeriaCore (mod) : `AutoBroadcast.java`, `CmdBlocks.java`, `CustomItems.java`
  -> rebuild + redéploiement aux joueurs (avec rapport, jamais seul).
- EmeriaLauncher : `install.js` (AXIOM_PANEL_URL) -> rebuild des 3 OS.
- EmeriaSite : variable `PANEL_URL` (déjà lue via env, juste à définir).
- Bot : variable `SITE_URL` (déjà lue via env, juste à définir sur son hôte).

---

## A noter

- Le **bot Discord** tourne déjà ailleurs (worker, pas Vercel), il n'est pas
  concerné par cette migration.
- **EmeriaSite** (site public) reste sur Vercel pour l'instant. En sortant le
  panel (le gros consommateur) de Vercel + le polling du mod déjà réduit ~10x,
  le compte devrait repasser sous le quota gratuit. Si besoin, on migrera
  EmeriaSite ensuite (c'est plus simple : statique + quelques fonctions).
