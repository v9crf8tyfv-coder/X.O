import type { Client, GuildMember } from 'discord.js';
import { db, hasDatabase } from '@xo/db';

/**
 * À l'arrivée d'un membre : attribue les rôles auto configurés via /panel.
 */
export async function onGuildMemberAdd(
  _client: Client,
  member: GuildMember,
): Promise<void> {
  if (!hasDatabase()) return;
  try {
    const rows = await db()<{ role_id: string }[]>`
      select role_id from panel_auto_roles
    `;
    for (const { role_id } of rows) {
      const role = member.guild.roles.cache.get(role_id);
      if (role) {
        await member.roles.add(role, 'Rôle automatique (/panel)').catch(() => {});
      }
    }
  } catch (err) {
    console.error('[guildMemberAdd] erreur auto-rôle:', err);
  }
}
