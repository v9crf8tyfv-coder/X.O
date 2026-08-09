import {
  AuditLogEvent,
  type Client,
  type GuildMember,
  type PartialGuildMember,
} from 'discord.js';
import { ALL_GRADES, getGrade, type SurveillanceCategory } from '@xo/shared';
import { logSurveillance } from '../lib/surveillance.js';

/** roleId -> clé de grade (uniquement les rôles-grades) */
const ROLE_TO_GRADE = new Map<string, string>();
for (const g of Object.values(ALL_GRADES)) {
  if (g.roleId) ROLE_TO_GRADE.set(g.roleId, g.key);
}

/** Catégorie de surveillance d'un membre = celle de son grade le plus élevé */
function memberCategory(member: GuildMember): SurveillanceCategory {
  let best: SurveillanceCategory = 'none';
  let lvl = -1;
  for (const roleId of member.roles.cache.keys()) {
    const gk = ROLE_TO_GRADE.get(roleId);
    if (!gk) continue;
    const g = getGrade(gk);
    if (g.level > lvl) {
      lvl = g.level;
      best = g.surveillance;
    }
  }
  return best;
}

/**
 * Surveille les changements de rôles faits DIRECTEMENT sur Discord.
 * Le salon dépend du grade de l'AUTEUR (respo/admin/staff). On ignore :
 *  - les changements faits par le BOT (le worker les logge déjà, avec le pseudo site) ;
 *  - les actions des fonda/co-fonda (catégorie 'none').
 */
export async function onGuildMemberUpdate(
  client: Client,
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
): Promise<void> {
  const oldRoles = oldMember.roles?.cache;
  if (!oldRoles) return;

  const added = [...newMember.roles.cache.keys()].filter((id) => !oldRoles.has(id));
  const removed = [...oldRoles.keys()].filter((id) => !newMember.roles.cache.has(id));
  const changed = [...added, ...removed].filter((id) => ROLE_TO_GRADE.has(id));
  if (changed.length === 0) return;

  const exec = await fetchExecutor(newMember);
  if (!exec) return;
  if (exec.id === client.user?.id) return; // fait par le bot → worker s'en charge

  const category = memberCategory(exec);
  if (category === 'none') return; // fonda/co-fonda ou non-staff → pas surveillé

  for (const roleId of added) {
    const gk = ROLE_TO_GRADE.get(roleId);
    if (!gk) continue;
    await logSurveillance(client, {
      category,
      action: 'Ajout de rôle',
      actor: exec.user.tag,
      target: newMember.user.tag,
      source: 'discord',
      fields: [{ name: 'Rôle', value: getGrade(gk).label }],
    });
  }
  for (const roleId of removed) {
    const gk = ROLE_TO_GRADE.get(roleId);
    if (!gk) continue;
    await logSurveillance(client, {
      category,
      action: 'Retrait de rôle',
      actor: exec.user.tag,
      target: newMember.user.tag,
      source: 'discord',
      fields: [{ name: 'Rôle', value: getGrade(gk).label }],
    });
  }
}

/** Récupère le membre qui a fait le dernier changement de rôle */
async function fetchExecutor(member: GuildMember): Promise<GuildMember | null> {
  try {
    const logs = await member.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberRoleUpdate,
      limit: 5,
    });
    const entry = logs.entries.find(
      (e) => e.target?.id === member.id && Date.now() - e.createdTimestamp < 10_000,
    );
    if (!entry?.executor) return null;
    return member.guild.members.fetch(entry.executor.id).catch(() => null);
  } catch {
    return null;
  }
}
