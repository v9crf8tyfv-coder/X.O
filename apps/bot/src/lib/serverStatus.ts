import { AttachmentBuilder, type Client, type TextChannel } from 'discord.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { db, hasDatabase } from '@xo/db';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATUS_CHANNEL_ID = '1535349226626613268';
// Le message de statut ping UNIQUEMENT ce rôle (plus le rôle joueur).
const PING_ROLES = ['1540339218759426149'];
const MSG_KEY = 'status_message';
// Images à déposer : apps/bot/assets/status-open.png (vert) et status-close.png (rouge)

/** Poste le message de statut (supprime le précédent) + ping les joueurs. */
export async function postStatus(client: Client, isOpen: boolean): Promise<void> {
  const channel = await client.channels.fetch(STATUS_CHANNEL_ID).catch(() => null);
  if (!channel?.isTextBased()) return;
  const ch = channel as TextChannel;

  if (hasDatabase()) {
    const rows = await db()<{ value: string }[]>`select value from bot_state where key = ${MSG_KEY}`;
    if (rows.length) await ch.messages.delete(rows[0]!.value).catch(() => {});
  }

  const pings = PING_ROLES.map((r) => `<@&${r}>`).join(' ');
  const content = `# Serveur ${isOpen ? 'OPEN' : 'CLOSE'}\n-# ${pings}`;
  const img = resolve(__dirname, `../../assets/status-${isOpen ? 'open' : 'close'}.png`);
  const files = existsSync(img) ? [new AttachmentBuilder(img, { name: 'statut.png' })] : [];

  const msg = await ch.send({ content, files, allowedMentions: { roles: PING_ROLES } });
  await msg.react('💜').catch(() => {});
  await msg.react('✅').catch(() => {});

  if (hasDatabase()) {
    await db()`
      insert into bot_state (key, value) values (${MSG_KEY}, ${msg.id})
      on conflict (key) do update set value = excluded.value
    `;
  }
}
