import { EmbedBuilder, type Client, type Message, type TextChannel, type GuildMember } from 'discord.js';
import { GRADES } from '@xo/shared';
import { getAnnounceChannel } from '../lib/announceState.js';
import { isRunning, handleAnswer } from '../lib/train.js';
import { highestGrade } from '../lib/permissions.js';

/**
 * Entraînement modération : dans le salon en session, un staff répond
 * `mute pseudo temps raison`. On valide et on enchaîne le cas suivant.
 * Retourne true si le message a été « consommé » par l'entraînement.
 */
/** Verbes de sanction reconnus comme une réponse d'entraînement */
const SANCTION_RE = /^(mute|tempmute|warn|kick|ban|tempban|unmute|unban|sanction)\b/i;

async function handleTrainMessage(client: Client, message: Message): Promise<boolean> {
  if (!isRunning(message.channelId)) return false;
  const content = message.content.trim();
  if (!SANCTION_RE.test(content)) return false;

  // Réservé aux modos et au-dessus
  const member = message.member as GuildMember | null;
  if (!member || (highestGrade(member)?.level ?? 0) < GRADES.modo.level) return false;

  const channel = message.channel as TextChannel;
  const consumed = await handleAnswer(client, channel, message.author.tag, content);
  if (!consumed) return false;

  // On nettoie la réponse du staff : le nouveau cas est déjà affiché, tout est loggué.
  await message.delete().catch(() => {});
  return true;
}

/**
 * Mode annonce : si l'auteur est en mode annonce dans CE salon, on supprime son
 * message et on le reposte via le bot. Les images sont ré-affichées en VRAIE image
 * (embed), pas en fichier joint.
 */
export async function onMessageCreate(_client: Client, message: Message): Promise<void> {
  if (message.author.bot || !message.inGuild()) return;

  // Entraînement modération (salon en session) — prioritaire
  if (await handleTrainMessage(_client, message)) return;

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
