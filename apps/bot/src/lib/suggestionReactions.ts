import type { Message } from 'discord.js';

/** Salon des suggestions : chaque nouveau post reçoit un vote pour/contre. */
const SUGGESTION_CHANNEL = '1554142755507277945';

/**
 * Ajoute les réactions :Good: et :Refus: sur un nouveau post du salon suggestions,
 * pour que les gens votent. Léger : aucune donnée gardée en mémoire, juste 2 réactions.
 * Retourne true si le message était bien un post de suggestion (traité).
 */
export async function reactSuggestion(message: Message): Promise<boolean> {
  const ch = message.channel;
  const inSuggestion =
    message.channelId === SUGGESTION_CHANNEL ||
    ('parentId' in ch && ch.parentId === SUGGESTION_CHANNEL); // forum : post = thread enfant
  if (!inSuggestion) return false;

  const guild = message.guild;
  if (!guild) return true;
  const find = (name: string) =>
    guild.emojis.cache.find((e) => e.name?.toLowerCase() === name.toLowerCase());

  const good = find('Good');
  const refus = find('Refus');
  // React en séquence (Good puis Refus) pour garder l'ordre d'affichage.
  if (good) await message.react(good).catch(() => {});
  if (refus) await message.react(refus).catch(() => {});
  return true;
}
