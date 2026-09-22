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
      added_by text,
      primary key (pseudo, channel_id)
    )
  `;
  // Colonne ajoutée après coup (tables existantes) : on la crée si absente.
  await db()`alter table tracked_players add column if not exists added_by text`.catch(() => {});
}

// État précédent : pseudo(minuscule) -> nom affiché. Amorcé au 1er tick (aucun post au démarrage).
let prev: Map<string, string> | null = null;

/** Liste des joueurs en ligne, ou null si la requête a ÉCHOUÉ (à distinguer de "serveur vide"). */
async function onlineList(): Promise<string[] | null> {
  try {
    const r = await queryFull(HOST, PORT, { timeout: 5000 });
    return r.players?.list ?? [];
  } catch {
    return null; // échec réseau -> on ne touche PAS à l'état (évite fausses déco / déco manquées)
  }
}

async function tick(client: Client): Promise<void> {
  if (!hasDatabase()) return;
  const online = await onlineList();
  if (online === null) return; // query échouée -> on garde l'état précédent tel quel
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

  // Joueurs suivis (activés) -> map pseudo(minuscule) -> [{salon, qui a activé}]
  const rows = await db()<{ pseudo: string; channel_id: string; added_by: string | null }[]>`
    select pseudo, channel_id, added_by from tracked_players where enabled = true
  `.catch(() => [] as { pseudo: string; channel_id: string; added_by: string | null }[]);
  if (rows.length === 0) return;

  const targetsFor = new Map<string, { channel_id: string; added_by: string | null }[]>();
  for (const r of rows) {
    const k = r.pseudo.toLowerCase();
    (targetsFor.get(k) ?? targetsFor.set(k, []).get(k)!).push({
      channel_id: r.channel_id,
      added_by: r.added_by,
    });
  }

  const post = async (name: string, up: boolean) => {
    const targets = targetsFor.get(name.toLowerCase());
    if (!targets) return;
    const embed = new EmbedBuilder()
      .setColor(up ? 0x3ba55d : 0xe0574d)
      .setDescription(`${up ? '🟢' : '🔴'} **${name}** s'est ${up ? 'connecté' : 'déconnecté'}.`)
      .setTimestamp();
    for (const t of targets) {
      const ch = await client.channels.fetch(t.channel_id).catch(() => null);
      if (ch?.isTextBased()) {
        await (ch as TextChannel)
          .send({
            content: t.added_by ? `<@${t.added_by}>` : undefined,
            embeds: [embed],
          })
          .catch(() => {});
      }
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
