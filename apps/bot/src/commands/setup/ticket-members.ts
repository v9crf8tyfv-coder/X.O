import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

/** /add <membre|rôle> — ajoute un membre OU tous ceux d'un rôle au ticket (salon) actuel. */
export const ticketAdd: SlashCommand = {
  minLevel: GRADES.supermodo.level,
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Ajoute un membre (ou tous ceux d’un rôle) au ticket actuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre à ajouter').setRequired(false))
    .addRoleOption((o) => o.setName('role').setDescription('Ajoute tous les membres qui ont ce rôle').setRequired(false)),
  async execute(interaction) {
    const ch = interaction.channel as TextChannel | null;
    if (!ch || !('permissionOverwrites' in ch)) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'À faire dans un salon de ticket.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const user = interaction.options.getUser('membre', false);
    const role = interaction.options.getRole('role', false);
    if (!user && !role) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'Indique un **membre** ou un **rôle** à ajouter.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const allow = { ViewChannel: true, SendMessages: true, ReadMessageHistory: true };
    const parts: string[] = [];
    if (user) {
      await ch.permissionOverwrites.edit(user.id, allow);
      parts.push(`<@${user.id}>`);
    }
    if (role) {
      // Un overwrite de rôle donne l'accès à TOUS ceux qui ont ce rôle (en une fois).
      await ch.permissionOverwrites.edit(role.id, allow);
      parts.push(`<@&${role.id}>`);
    }
    await interaction.reply({ embeds: [successEmbed('Ajouté au ticket', `${parts.join(' et ')} ${parts.length > 1 ? 'ont' : 'a'} été ajouté(s) au ticket.`)] });
  },
};

/** /remove <membre|rôle> — retire un membre OU tous ceux d'un rôle du ticket (salon) actuel. */
export const ticketRemove: SlashCommand = {
  minLevel: GRADES.supermodo.level,
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Retire un membre (ou tous ceux d’un rôle) du ticket actuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre à retirer').setRequired(false))
    .addRoleOption((o) => o.setName('role').setDescription('Retire tous les membres qui ont ce rôle').setRequired(false)),
  async execute(interaction) {
    const ch = interaction.channel as TextChannel | null;
    if (!ch || !('permissionOverwrites' in ch)) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'À faire dans un salon de ticket.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const user = interaction.options.getUser('membre', false);
    const role = interaction.options.getRole('role', false);
    if (!user && !role) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'Indique un **membre** ou un **rôle** à retirer.')], flags: MessageFlags.Ephemeral });
      return;
    }
    // Interdiction EXPLICITE : écrase l'accès donné par un rôle (grade/com).
    // Un simple delete() ne retirerait que l'invitation perso, pas l'accès via rôle.
    const deny = { ViewChannel: false, SendMessages: false, ReadMessageHistory: false };
    const parts: string[] = [];
    if (user) {
      await ch.permissionOverwrites.edit(user.id, deny).catch(() => {});
      parts.push(`<@${user.id}>`);
    }
    if (role) {
      await ch.permissionOverwrites.edit(role.id, deny).catch(() => {});
      parts.push(`<@&${role.id}>`);
    }
    await interaction.reply({ embeds: [successEmbed('Retiré du ticket', `${parts.join(' et ')} ${parts.length > 1 ? 'ne peuvent' : 'ne peut'} plus voir le ticket.`)] });
  },
};
