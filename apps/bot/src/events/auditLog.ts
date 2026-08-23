import { AuditLogEvent, type Client, type Guild, type GuildAuditLogsEntry } from 'discord.js';
import { logSurveillance } from '../lib/surveillance.js';
import { memberSurveillanceCategory } from '../lib/surveillanceCategory.js';

/** Actions d'audit suivies -> nom lisible. (MemberRoleUpdate est déjà géré ailleurs, avec le détail du grade.) */
const ACTION_NAMES: Partial<Record<AuditLogEvent, string>> = {
  [AuditLogEvent.MemberKick]: 'Kick',
  [AuditLogEvent.MemberBanAdd]: 'Bannissement',
  [AuditLogEvent.MemberBanRemove]: 'Débannissement',
  [AuditLogEvent.MemberUpdate]: 'Modif membre (mute / timeout / pseudo)',
  [AuditLogEvent.MessageDelete]: 'Suppression de message',
  [AuditLogEvent.MessageBulkDelete]: 'Suppression de messages (masse)',
  [AuditLogEvent.MessagePin]: 'Message épinglé',
  [AuditLogEvent.MessageUnpin]: 'Message désépinglé',
  [AuditLogEvent.ChannelCreate]: 'Création de salon',
  [AuditLogEvent.ChannelDelete]: 'Suppression de salon',
  [AuditLogEvent.ChannelUpdate]: 'Modif de salon',
  [AuditLogEvent.ChannelOverwriteCreate]: 'Modif permissions salon',
  [AuditLogEvent.ChannelOverwriteUpdate]: 'Modif permissions salon',
  [AuditLogEvent.ChannelOverwriteDelete]: 'Modif permissions salon',
  [AuditLogEvent.RoleCreate]: 'Création de rôle',
  [AuditLogEvent.RoleDelete]: 'Suppression de rôle',
  [AuditLogEvent.RoleUpdate]: 'Modif de rôle',
  [AuditLogEvent.MemberMove]: 'Déplacement vocal',
  [AuditLogEvent.MemberDisconnect]: 'Déconnexion vocale',
  [AuditLogEvent.InviteCreate]: "Création d'invitation",
  [AuditLogEvent.EmojiCreate]: "Création d'emoji",
  [AuditLogEvent.EmojiDelete]: "Suppression d'emoji",
  [AuditLogEvent.WebhookCreate]: 'Création de webhook',
};

/**
 * Surveillance globale : chaque action d'un STAFF dans l'audit log Discord est loguée
 * dans le salon de sa catégorie (respo/admin/staff). Ignore le bot et les fonda.
 */
export async function onAuditLog(client: Client, entry: GuildAuditLogsEntry, guild: Guild): Promise<void> {
  const action = ACTION_NAMES[entry.action as AuditLogEvent];
  if (!action) return;

  const executorId = entry.executorId;
  if (!executorId || executorId === client.user?.id) return; // action du bot -> déjà loguée ailleurs

  const member = await guild.members.fetch(executorId).catch(() => null);
  if (!member) return;

  const category = memberSurveillanceCategory(member);
  if (category === 'none') return; // fonda / co-fonda / non-staff -> pas surveillé

  let target: string | null = null;
  if (entry.targetId) {
    target = entry.targetType === 'User' ? `<@${entry.targetId}>` : `\`${entry.targetId}\``;
  }

  const fields: { name: string; value: string }[] = [];
  if (entry.reason) fields.push({ name: 'Raison', value: entry.reason.slice(0, 1000) });

  await logSurveillance(client, {
    category,
    action,
    actor: member.user.tag,
    target,
    source: 'discord',
    fields: fields.length ? fields : undefined,
  });
}
