import type { Client, GuildMember } from 'discord.js';
import { ROLE_INCONNU } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';

/**
 * À l'arrivée d'un membre : lui donne le rôle INCONNU (accès à un seul salon, où il doit
 * choisir comment il a connu EmeriaMC) + les rôles auto configurés. Le rôle Joueur (accès
 * complet) n'est donné qu'après ce choix (voir interactions/entree.ts). Les bots sont ignorés.
 */
export async function onGuildMemberAdd(
  _client: Client,
  member: GuildMember,
): Promise<void> {
  if (member.user.bot) return;

  // 1) Rôle Inconnu d'office — accès limité tant que la source d'entrée n'est pas choisie.
  try {
    const inconnu = member.guild.roles.cache.get(ROLE_INCONNU);
    if (inconnu && !member.roles.cache.has(inconnu.id)) {
      await member.roles.add(inconnu, "Arrivée (à définir : comment a-t-il connu Emeria)").catch(() => {});
    }
  } catch (err) {
    console.error('[guildMemberAdd] erreur rôle Inconnu:', err);
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
