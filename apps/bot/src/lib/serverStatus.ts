import { AttachmentBuilder, EmbedBuilder, MessageType, type Client, type TextChannel } from 'discord.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { db, hasDatabase } from '@xo/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATUS_CHANNEL_ID = '1535349226626613268';
// Le message de statut ping UNIQUEMENT le rôle "statut" (plus joueur/membre/staff).
const PING_ROLES = ['1540339127784968293'];
const MSG_KEY = 'status_message';
// Images à déposer : apps/bot/assets/status-open.png (vert) et status-close.png (rouge)

/** Logo EmeriaMC (comme les annonces de reset). */
const EMERIA = '<:EmeriaMC:1541095551511298139>';

/** État du statut posté dans le salon : ouvert, fermé, ou maintenance planifiée (manuelle). */
export type StatusMode = 'open' | 'close' | 'maintenance';

/** Poste le message de statut (embed) + ping, et le garde AU-DESSUS des resets. */
export async function postStatus(client: Client, mode: StatusMode | boolean): Promise<void> {
  // Rétro-compat : certains appels passent encore un booléen (true = open).
  const m: StatusMode = typeof mode === 'boolean' ? (mode ? 'open' : 'close') : mode;
  const channel = await client.channels.fetch(STATUS_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;
  const ch = channel as TextChannel;

  if (hasDatabase()) {
    const rows = await db()<{ value: string }[]>`select value from bot_state where key = ${MSG_KEY}`;
    if (rows.length) await ch.messages.delete(rows[0]!.value).catch(() => {});
  }

  const pings = PING_ROLES.map((r) => `<@&${r}>`).join(' ');
  // Image par état : status-open.png (vert) / status-close.png (rouge) / status-maintenance.png (orange).
  const imgName = m === 'open' ? 'status-open' : m === 'maintenance' ? 'status-maintenance' : 'status-close';
  const img = resolve(__dirname, `../../assets/${imgName}.png`);
  const hasImg = existsSync(img);
  const files = hasImg ? [new AttachmentBuilder(img, { name: 'statut.png' })] : [];

  // Embed aux couleurs de l'image (vert ouvert / rouge fermé / orange maintenance) + logo + citation.
  const desc =
    m === 'open'
      ? `-# ➡️ ${pings}\n\nL'équipe d'EmeriaMC vous souhaite un **bon jeu** ! 🎮\n\n> ${EMERIA}  **L'équipe d'EmeriaMC.**`
      : m === 'maintenance'
        ? `-# ➡️ ${pings}\n\n**Maintenance en cours** — le serveur est momentanément indisponible. Les **Hauts Staff** s'en occupent, merci de votre patience. 🔧\n\n> ${EMERIA}  **L'équipe d'EmeriaMC.**`
        : `-# ➡️ ${pings}\n\n**Serveur fermé** — les **Hauts Staff** sont sur le coup. Merci de votre patience. 🔧\n\n> ${EMERIA}  **L'équipe d'EmeriaMC.**`;
  const embed = new EmbedBuilder()
    .setColor(m === 'open' ? 0x2e7d32 : m === 'maintenance' ? 0xe8740c : 0x8d1b11)
    .setTitle(m === 'open' ? '✅  Serveur OPEN' : m === 'maintenance' ? '🔧  Maintenance en cours' : '🆑  Serveur Close')
    .setDescription(desc)
    .setTimestamp();
  if (hasImg) embed.setImage('attachment://statut.png');

  // Le ping va dans le contenu (les embeds ne notifient pas), le reste dans l'embed.
  const msg = await ch.send({
    content: pings,
    embeds: [embed],
    files,
    allowedMentions: { roles: PING_ROLES },
  });
  await msg.pin().catch(() => {}); // le statut reste épinglé en haut
  await msg.react('💜').catch(() => {});
  await msg.react(m === 'open' ? '✅' : m === 'maintenance' ? '🔧' : '🆑').catch(() => {});

  // Nettoyage : désépingle les anciens statuts + supprime les notices "X.O a épinglé un message".
  try {
    const pinned = await ch.messages.fetchPinned();
    for (const pm of pinned.values()) if (pm.id !== msg.id) await pm.unpin().catch(() => {});
  } catch { /* ignore */ }
  try {
    const recent = await ch.messages.fetch({ limit: 30 });
    for (const rm of recent.values()) {
      if (rm.type === MessageType.ChannelPinnedMessage) await rm.delete().catch(() => {});
    }
  } catch { /* ignore */ }

  if (hasDatabase()) {
    await db()`
      insert into bot_state (key, value) values (${MSG_KEY}, ${msg.id})
      on conflict (key) do update set value = excluded.value
    `;
  }

  // Le statut doit rester AU-DESSUS des resets -> on repousse les resets sous lui (sans re-ping).
  await bumpResetsBelow(ch);
}

/** Re-poste les annonces de reset SOUS le statut (chronologie), sans les re-pinger. */
async function bumpResetsBelow(ch: TextChannel): Promise<void> {
  if (!hasDatabase()) return;
  for (const key of ['reset_monde', 'reset_end']) {
    try {
      const rows = await db()<{ value: string }[]>`select value from bot_state where key = ${key}`;
      const rid = rows[0]?.value;
      if (!rid) continue;
      const rm = await ch.messages.fetch(rid).catch(() => null);
      if (!rm) continue;
      const atts = [...rm.attachments.values()];
      const files = atts.map((a) => new AttachmentBuilder(a.url, { name: a.name }));
      const embeds = rm.embeds.map((e) => {
        const b = EmbedBuilder.from(e);
        // Re-pointe vignette/image vers la pièce jointe RÉ-uploadée (sinon elle pointe vers
        // l'ancienne, supprimée -> icône disparue, ex. le logo Nether/Mine).
        if (e.thumbnail && atts[0]) b.setThumbnail('attachment://' + atts[0].name);
        if (e.image && atts[0]) b.setImage('attachment://' + atts[0].name);
        return b;
      });
      const resent = await ch.send({
        content: rm.content || undefined,
        embeds,
        files,
        allowedMentions: { parse: [] }, // pas de re-ping
      });
      await rm.delete().catch(() => {});
      await db()`update bot_state set value = ${resent.id} where key = ${key}`;
    } catch { /* ignore */ }
  }
}
