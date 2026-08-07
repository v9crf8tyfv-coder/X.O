import {
  AuditLogEvent,
  type Client,
  type GuildMember,
  type PartialGuildMember,
} from 'discord.js';
import { ALL_GRADES, GRADES, getGrade } from '@xo/shared';
import { logSurveillance } from '../lib/surveillance.js';

/** roleId -> clé de grade (uniquement les rôles-grades) */
const ROLE_TO_GRADE = new Map<string, string>();
for (const g of Object.values(ALL_GRADES)) {
  if (g.roleId) ROLE_TO_GRADE.set(g.roleId, g.key);
}

/**
 * Surveille les changements de rôles.
 * Chaque ajout/retrait de rôle-grade est loggé dans le bon salon,
 * SAUF si l'action a été faite par un fondateur.
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

  // Qui a fait le changement ? (audit log)
  const executor = await fetchRoleUpdateExecutor(newMember);

  // Règle : les actions des fondateurs ne sont pas surveillées
  if (executor?.founder) return;

  const actorLabel = executor?.tag ?? 'Inconnu';

  for (const roleId of added) {
    const gk = ROLE_TO_GRADE.get(roleId);
    if (!gk) continue;
    const grade = getGrade(gk);
    if (grade.surveillance === 'none') continue;
    await logSurveillance(client, {
      category: grade.surveillance,
      action: 'Ajout de rôle',
      actor: actorLabel,
      target: newMember.user.tag,
      source: 'discord',
      fields: [{ name: 'Rôle', value: grade.label }],
      details: { roleId, grade: gk },
    });
  }

  for (const roleId of removed) {
    const gk = ROLE_TO_GRADE.get(roleId);
    if (!gk) continue;
    const grade = getGrade(gk);
    if (grade.surveillance === 'none') continue;
    await logSurveillance(client, {
      category: grade.surveillance,
      action: 'Retrait de rôle',
      actor: actorLabel,
      target: newMember.user.tag,
      source: 'discord',
      fields: [{ name: 'Rôle', value: grade.label }],
      details: { roleId, grade: gk },
    });
  }
}

/** Récupère l'auteur du dernier changement de rôle sur ce membre */
async function fetchRoleUpdateExecutor(
  member: GuildMember,
): Promise<{ tag: string; founder: boolean } | null> {
  try {
    const logs = await member.guild.fetchAuditLogs({
      type: AuditLogEvent.MemberRoleUpdate,
      limit: 5,
    });
    const entry = logs.entries.find(
      (e) => e.target?.id === member.id && Date.now() - e.createdTimestamp < 10_000,
    );
    if (!entry?.executor) return null;

    let founder = false;
    if (GRADES.fondateur.roleId) {
      const exec = await member.guild.members
        .fetch(entry.executor.id)
        .catch(() => null);
      founder = exec?.roles.cache.has(GRADES.fondateur.roleId) ?? false;
    }
    return { tag: entry.executor.tag ?? 'Inconnu', founder };
  } catch {
    return null;
  }
}
