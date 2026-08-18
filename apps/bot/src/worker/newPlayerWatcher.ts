import type { Client, TextChannel } from 'discord.js';
import { queryFull } from 'minecraft-server-util';
import { db, hasDatabase } from '@xo/db';

const HOST = 'emeriamc.mine.gg';
const PORT = 10006;
const WELCOME_CHANNEL = '1535347207195328652';
const LOGO = '<:Logojoueur:1536109797114515518>';

// Tant que l'amorçage n'est pas fait, on ne poste rien (évite de spammer au démarrage).
let seeded = false;

async function ensureTable(): Promise<void> {
  await db()`
    create table if not exists seen_players (
      pseudo text primary key,
      first_seen timestamptz not null default now()
    )
  `;
}

async function onlineList(): Promise<string[]> {
  try {
    const r = await queryFull(HOST, PORT, { timeout: 5000 });
    return r.players?.list ?? [];
  } catch {
    return [];
  }
}

async function tick(client: Client): Promise<void> {
  if (!seeded) return; // amorçage pas encore terminé
  const online = await onlineList();
  if (online.length === 0) return;

  const known = await db()<{ pseudo: string }[]>`select pseudo from seen_players`;
  const knownSet = new Set(known.map((k) => k.pseudo.toLowerCase()));
  const fresh = online.filter((p) => !knownSet.has(p.toLowerCase()));
  if (fresh.length === 0) return;

  const ch = await client.channels.fetch(WELCOME_CHANNEL).catch(() => null);
  for (const p of fresh) {
    await db()`insert into seen_players (pseudo) values (${p}) on conflict (pseudo) do nothing`;
    if (ch?.isTextBased()) {
      await (ch as TextChannel)
        .send(`${LOGO} Bienvenue à **${p}**, qui vient de se connecter pour la première fois !`)
        .catch(() => {});
    }
  }
}

/** Souhaite la bienvenue (Discord) au 1er passage IG d'un joueur. */
export function startNewPlayerWatcher(client: Client): void {
  if (!hasDatabase()) {
    console.log('[welcome] pas de base → désactivé');
    return;
  }
  (async () => {
    await ensureTable();
    // Amorçage : on marque les joueurs déjà en ligne (sans message), puis on accueille les suivants
    const online = await onlineList();
    for (const p of online) {
      await db()`insert into seen_players (pseudo) values (${p}) on conflict (pseudo) do nothing`;
    }
    seeded = true;
    console.log(`[welcome] amorçage OK (${online.length} joueur(s) déjà en ligne)`);
  })().catch((e) => console.error('[welcome] init', e));

  console.log('[welcome] surveillance nouveaux joueurs démarrée (1 min)');
  setInterval(() => {
    tick(client).catch((e) => console.error('[welcome]', e));
  }, 60_000);
}
