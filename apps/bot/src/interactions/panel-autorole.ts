import { MessageFlags, type RoleSelectMenuInteraction } from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { db, hasDatabase } from '@xo/db';
import { successEmbed, errorEmbed } from '../lib/embeds.js';

/**
 * Enregistre les rôles auto-attribués à l'arrivée (config /panel).
 * La sélection REMPLACE la liste précédente.
 */
export const panelAutoRole: ComponentHandler<RoleSelectMenuInteraction> = {
  prefix: 'panel:autorole',
  async execute(interaction) {
    if (!hasDatabase()) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            'Base non configurée',
            'Configure Supabase (DATABASE_URL) pour enregistrer les rôles auto.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const roleIds = interaction.values;
    try {
      await db().begin(async (sql) => {
        await sql`delete from panel_auto_roles`;
        for (const roleId of roleIds) {
          const role = interaction.guild?.roles.cache.get(roleId);
          await sql`
            insert into panel_auto_roles (role_id, label, created_by)
            values (${roleId}, ${role?.name ?? null}, ${interaction.user.tag})
            on conflict (role_id) do nothing
          `;
        }
      });

      const label =
        roleIds.length === 0
          ? 'Aucun rôle automatique (désactivé).'
          : roleIds.map((id) => `<@&${id}>`).join(', ');

      await interaction.reply({
        embeds: [successEmbed('Rôles auto enregistrés', label)],
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      console.error('[panel:autorole] erreur:', err);
      await interaction.reply({
        embeds: [errorEmbed('Erreur', "Impossible d'enregistrer les rôles.")],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
