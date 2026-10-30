import { type Client, type GuildMember, type PartialGuildMember, type TextChannel } from 'discord.js';

/** Salon (serveur communautaire) où X.O annonce les arrivées / départs. */
const COMMUNITY_LOG_CHANNEL = '1565454208830800174';

/**
 * Annonce une arrivée / un départ dans le salon communautaire.
 * Le message PING le membre ( <@id> ) + met son pseudo entre parenthèses :
 *   « @membre (username) a rejoint le Discord. »
 * Le membre qui rejoint n'a pas accès au salon, donc il n'est pas réellement notifié,
 * mais le ping reste cliquable côté staff. N'annonce que pour le serveur du salon.
 */
export async function announceMember(
  client: Client,
  member: GuildMember | PartialGuildMember,
  joined: boolean,
): Promise<void> {
  try {
    const channel = await client.channels.fetch(COMMUNITY_LOG_CHANNEL).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    const ch = channel as TextChannel;
    if (member.guild.id !== ch.guild.id) return; // uniquement le serveur de ce salon
    const name = member.user?.username ?? 'inconnu';
    const msg = joined
      ? `🟢 <@${member.id}> (${name}) a rejoint le Discord.`
      : `🔴 <@${member.id}> (${name}) a quitté le Discord.`;
    await ch.send({ content: msg, allowedMentions: { users: [member.id] } });
  } catch {
    /* non bloquant */
  }
}
