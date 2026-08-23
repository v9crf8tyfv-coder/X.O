import { EmbedBuilder, type Client, type Message, type TextChannel } from 'discord.js';
import { getAnnounceChannel } from '../lib/announceState.js';

/**
 * Mode annonce : si l'auteur est en mode annonce dans CE salon, on supprime son
 * message et on le reposte via le bot. Les images sont ré-affichées en VRAIE image
 * (embed), pas en fichier joint.
 */
export async function onMessageCreate(_client: Client, message: Message): Promise<void> {
  if (message.author.bot || !message.inGuild()) return;
  const target = getAnnounceChannel(message.author.id);
  if (!target || target !== message.channelId) return;

  const content = message.content;
  const atts = [...message.attachments.values()];
  if (!content && atts.length === 0) return;

  const isImage = (a: (typeof atts)[number]) =>
    (a.contentType?.startsWith('image/') ?? false) || /\.(png|jpe?g|gif|webp)$/i.test(a.name ?? '');

  const files: Array<string | { attachment: string; name: string }> = [];
  const embeds: EmbedBuilder[] = [];
  let imgIdx = 0;
  for (const a of atts) {
    if (isImage(a)) {
      const ext = (a.name?.split('.').pop() || 'png').toLowerCase();
      const name = `image${imgIdx++}.${ext}`;
      files.push({ attachment: a.url, name }); // ré-upload -> l'image reste valide après suppression
      embeds.push(new EmbedBuilder().setColor(0x8b5cf6).setImage(`attachment://${name}`));
    } else {
      files.push(a.url);
    }
  }

  // On envoie AVANT de supprimer (pour que les URLs des images soient encore valides)
  await (message.channel as TextChannel)
    .send({ content: content || undefined, files, embeds: embeds.length ? embeds : undefined })
    .catch(() => {});
  await message.delete().catch(() => {});
}
