import type { Client, TextChannel } from 'discord.js';
import { queryFull } from 'minecraft-server-util';
import { db, hasDatabase } from '@xo/db';

const HOST = 'emeriamc.mine.gg';
const PORT = 10006;
const WELCOME_CHANNEL = '1535347207195328652';
const LOGO = '<:Logojoueur:1536109797114515518>';

// false = on n'a pas encore "amorcé" (base vide) -> on marque sans souhaiter la bienvenue,
// pour éviter de spammer tous les joueurs déjà connus au 1er démarrage.
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
  const online = await onlineList();
  if (online.length === 0) return;

  const known = await db()<{ pseudo: string }[]>`select pseudo from seen_players`;
  const knownSet = new Set(known.map((k) => k.pseudo.toLowerCase()));
  const fresh = online.filter((p) => !knownSet.has(p.toLowerCase()));
  if (fresh.length === 0) return;

  // Marque les nouveaux comme "vus"
  for (const p of fresh) {
    await db()`insert into seen_players (pseudo) values (${p}) on conflict (pseudo) do nothing`;
  }

  // Amorçage : au tout 1er passage (base vide), on ne poste rien
  if (!seeded) {
    seeded = true;
    return;
  }

  const ch = await client.channels.fetch(WELCOME_CHANNEL).catch(() => null);
  if (!ch || !ch.isTextBased()) return;
  for (const p of fresh) {
    await (ch as TextChannel)
      .send(`${LOGO} Bienvenue à **${p}**, qui vient de se connecter pour la première fois !`)
      .catch(() => {});
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
    const c = await db()<{ n: string }[]>`select count(*)::text as n from seen_players`;
    // Si des joueurs sont déjà connus (redémarrage), on poste directement.
    seeded = Number(c[0]?.n ?? 0) > 0;
  })().catch((e) => console.error('[welcome] init', e));

  console.log('[welcome] surveillance nouveaux joueurs démarrée (1 min)');
  setInterval(() => {
    tick(client).catch((e) => console.error('[welcome]', e));
  }, 60_000);
}
