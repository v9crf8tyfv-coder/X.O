import type { Client, GuildMember } from 'discord.js';
import { GRADE_JOUEUR } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';

/**
 * À l'arrivée d'un membre : lui donne le rôle Joueur (grade par défaut) + les rôles
 * auto configurés (via /panel ou le site). Les bots sont ignorés.
 */
export async function onGuildMemberAdd(
  _client: Client,
  member: GuildMember,
): Promise<void> {
  if (member.user.bot) return;

  // 1) Rôle Joueur d'office (grade d'arrivée) — indépendant de la base
  try {
    const joueur = member.guild.roles.cache.get(GRADE_JOUEUR.roleId);
    if (joueur && !member.roles.cache.has(joueur.id)) {
      await member.roles.add(joueur, "Grade Joueur (arrivée)").catch(() => {});
    }
  } catch (err) {
    console.error('[guildMemberAdd] erreur rôle Joueur:', err);
  }

  // 2) Rôles auto configurés (panel_auto_roles)
  if (!hasDatabase()) return;
  try {
    const rows = await db()<{ role_id: string }[]>`
      select role_id from panel_auto_roles
    `;
    for (const { role_id } of rows) {
      const role = member.guild.roles.cache.get(role_id);
      if (role && !member.roles.cache.has(role.id)) {
        await member.roles.add(role, 'Rôle automatique (/panel)').catch(() => {});
      }
    }
  } catch (err) {
    console.error('[guildMemberAdd] erreur auto-rôle:', err);
  }
}
