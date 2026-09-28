import { type Client, type Message, type TextChannel, type GuildMember } from 'discord.js';
import { GRADES } from '@xo/shared';
import { getAnnounceChannel } from '../lib/announceState.js';
import { isRunning, handleAnswer } from '../lib/train.js';
import { highestGrade } from '../lib/permissions.js';
import { handleVoteLogMessage } from '../lib/voteLog.js';
import { reactSuggestion } from '../lib/suggestionReactions.js';

/**
 * Entraînement modération : dans le salon en session, un staff répond
 * `mute pseudo temps raison`. On valide et on enchaîne le cas suivant.
 * Retourne true si le message a été « consommé » par l'entraînement.
 */
/** Verbes de sanction reconnus comme une réponse d'entraînement */
const SANCTION_RE = /^(mute|tempmute|warn|kick|ban|tempban|unmute|unban|sanction|prevention|prévention|prev|rien|ras|ok)\b/i;

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
  // Salon de votes : on lit les messages des webhooks (donc AVANT le filtre "bot").
  if (await handleVoteLogMessage(message)) return;

  if (message.author.bot || !message.inGuild()) return;

  // Salon suggestions : on ajoute les réactions de vote (Good / Refus) puis on s'arrête.
  if (await reactSuggestion(message)) return;

  // Entraînement modération (salon en session) — prioritaire
  if (await handleTrainMessage(_client, message)) return;

  const target = getAnnounceChannel(message.author.id);
  if (!target || target !== message.channelId) return;

  const content = message.content;
  const atts = [...message.attachments.values()];
  if (!content && atts.length === 0) return;

  // Toutes les pièces jointes (images comprises) sont ré-uploadées en fichiers NORMAUX,
  // jamais en embed : une image annoncée s'affiche comme une vraie image Discord.
  const files: Array<{ attachment: string; name: string }> = [];
  let idx = 0;
  for (const a of atts) {
    const ext = (a.name?.split('.').pop() || 'bin').toLowerCase();
    files.push({ attachment: a.url, name: `file${idx++}.${ext}` }); // ré-upload -> reste valide après suppression
  }

  // On envoie AVANT de supprimer (pour que les URLs des pièces jointes soient encore valides)
  await (message.channel as TextChannel)
    .send({ content: content || undefined, files })
    .catch(() => {});
  await message.delete().catch(() => {});
}
