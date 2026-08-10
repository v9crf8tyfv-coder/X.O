import { type Client, type Message, type TextChannel } from 'discord.js';
import { getAnnounceChannel } from '../lib/announceState.js';

/**
 * Mode annonce : si l'auteur est en mode annonce dans CE salon, on supprime son
 * message et on le reposte via le bot.
 */
export async function onMessageCreate(_client: Client, message: Message): Promise<void> {
  if (message.author.bot || !message.inGuild()) return;
  const target = getAnnounceChannel(message.author.id);
  if (!target || target !== message.channelId) return;

  const content = message.content;
  const files = [...message.attachments.values()].map((a) => a.url);
  await message.delete().catch(() => {});
  if (!content && files.length === 0) return;

  await (message.channel as TextChannel)
    .send({ content: content || undefined, files })
    .catch(() => {});
}
