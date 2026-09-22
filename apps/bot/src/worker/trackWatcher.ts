import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { queryFull } from 'minecraft-server-util';
import { db, hasDatabase } from '@xo/db';

const HOST = 'emeriamc.mine.gg';
const PORT = 10006;
const EVERY_MS = 60_000; // 1 min (même granularité que les autres watchers)

/** Crée la table des joueurs suivis (partagée avec la commande /track). */
export async function ensureTrackTable(): Promise<void> {
  await db()`
    create table if not exists tracked_players (
      pseudo text not null,
      channel_id text not null,
      guild_id text,
      enabled boolean not null default true,
      primary key (pseudo, channel_id)
    )
  `;
}

// État précédent : pseudo(minuscule) -> nom affiché. Amorcé au 1er tick (aucun post au démarrage).
let prev: Map<string, string> | null = null;

async function onlineList(): Promise<string[]> {
  try {
    const r = await queryFull(HOST, PORT, { timeout: 5000 });
    return r.players?.list ?? [];
  } catch {
    return [];
  }
}

async function tick(client: Client): Promise<void> {
  if (!hasDatabase()) return;
  const online = await onlineList();
  const now = new Map<string, string>();
  for (const p of online) now.set(p.toLowerCase(), p);

  // Amorçage : on mémorise l'état sans rien poster (évite un flood de "connecté" au démarrage).
  if (prev === null) {
    prev = now;
    return;
  }

  const connected: string[] = [];
  const disconnected: string[] = [];
  for (const [k, name] of now) if (!prev.has(k)) connected.push(name);
  for (const [k, name] of prev) if (!now.has(k)) disconnected.push(name);
  prev = now;

  if (connected.length === 0 && disconnected.length === 0) return;

  // Joueurs suivis (activés) -> map pseudo(minuscule) -> salons
  const rows = await db()<{ pseudo: string; channel_id: string }[]>`
    select pseudo, channel_id from tracked_players where enabled = true
  `.catch(() => [] as { pseudo: string; channel_id: string }[]);
  if (rows.length === 0) return;

  const channelsFor = new Map<string, string[]>();
  for (const r of rows) {
    const k = r.pseudo.toLowerCase();
    (channelsFor.get(k) ?? channelsFor.set(k, []).get(k)!).push(r.channel_id);
  }

  const post = async (name: string, up: boolean) => {
    const chans = channelsFor.get(name.toLowerCase());
    if (!chans) return;
    const embed = new EmbedBuilder()
      .setColor(up ? 0x3ba55d : 0xe0574d)
      .setDescription(`${up ? '🟢' : '🔴'} **${name}** s'est ${up ? 'connecté' : 'déconnecté'}.`)
      .setTimestamp();
    for (const id of chans) {
      const ch = await client.channels.fetch(id).catch(() => null);
      if (ch?.isTextBased()) await (ch as TextChannel).send({ embeds: [embed] }).catch(() => {});
    }
  };

  for (const name of connected) await post(name, true);
  for (const name of disconnected) await post(name, false);
}

/** Poste un embed à chaque connexion/déconnexion des joueurs suivis via /track. */
export function startTrackWatcher(client: Client): void {
  if (!hasDatabase()) {
    console.log('[track] pas de base → désactivé');
    return;
  }
  ensureTrackTable()
    .then(() => console.log('[track] surveillance co/déco démarrée (1 min)'))
    .catch((e) => console.error('[track] init', e));
  setInterval(() => {
    tick(client).catch((e) => console.error('[track]', e));
  }, EVERY_MS);
}
