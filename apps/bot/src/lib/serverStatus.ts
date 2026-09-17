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

/** Poste le message de statut (embed) + ping, et le garde AU-DESSUS des resets. */
export async function postStatus(client: Client, isOpen: boolean): Promise<void> {
  const channel = await client.channels.fetch(STATUS_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;
  const ch = channel as TextChannel;

  if (hasDatabase()) {
    const rows = await db()<{ value: string }[]>`select value from bot_state where key = ${MSG_KEY}`;
    if (rows.length) await ch.messages.delete(rows[0]!.value).catch(() => {});
  }

  const pings = PING_ROLES.map((r) => `<@&${r}>`).join(' ');
  const img = resolve(__dirname, `../../assets/status-${isOpen ? 'open' : 'close'}.png`);
  const hasImg = existsSync(img);
  const files = hasImg ? [new AttachmentBuilder(img, { name: 'statut.png' })] : [];

  // Embed aux couleurs de l'image (rouge maintenance / vert ouvert) + logo + flèche + citation.
  const desc = isOpen
    ? `-# ➡️ ${pings}\n\nL'équipe d'EmeriaMC vous souhaite un **bon jeu** ! 🎮\n\n> ${EMERIA}  **L'équipe d'EmeriaMC.**`
    : `-# ➡️ ${pings}\n\n**Maintenance en cours** — les **Hauts Staff** sont sur le coup. Merci de votre patience. 🔧\n\n> ${EMERIA}  **L'équipe d'EmeriaMC.**`;
  const embed = new EmbedBuilder()
    .setColor(isOpen ? 0x2e7d32 : 0x8d1b11)
    .setTitle(isOpen ? '✅  Serveur OPEN' : '🆑  Serveur Close')
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
  await msg.react(isOpen ? '✅' : '🆑').catch(() => {});

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
      const files = [...rm.attachments.values()].map((a) => new AttachmentBuilder(a.url, { name: a.name }));
      const embeds = rm.embeds.map((e) => EmbedBuilder.from(e));
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
