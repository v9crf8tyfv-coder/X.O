import { MessageFlags, type ButtonInteraction } from 'discord.js';
import type { ComponentHandler } from '../types.js';

/** Bouton de rôle : clic = prend/retire le rôle dont l'ID est dans le customId (rolebtn:<id>). */
export const roleButton: ComponentHandler<ButtonInteraction> = {
  prefix: 'rolebtn',
  async execute(interaction) {
    const roleId = interaction.customId.split(':')[1];
    if (!roleId || !interaction.inGuild() || !interaction.guild) return;

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member) return;

    const role = interaction.guild.roles.cache.get(roleId);
    const has = member.roles.cache.has(roleId);
    try {
      if (has) await member.roles.remove(roleId);
      else await member.roles.add(roleId);
      await interaction.reply({
        content: has ? `❌ Rôle **${role?.name ?? 'rôle'}** retiré.` : `✅ Rôle **${role?.name ?? 'rôle'}** ajouté.`,
        flags: MessageFlags.Ephemeral,
      });
    } catch {
      await interaction.reply({
        content: "Impossible de modifier ce rôle (vérifie que le rôle du bot est **au-dessus** et qu'il a la permission Gérer les rôles).",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
