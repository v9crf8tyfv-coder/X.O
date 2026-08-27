import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

/** /add <membre> — ajoute un membre au ticket (salon) actuel. */
export const ticketAdd: SlashCommand = {
  minLevel: GRADES.modo.level,
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Ajoute un membre au ticket actuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre à ajouter').setRequired(true)),
  async execute(interaction) {
    const ch = interaction.channel as TextChannel | null;
    if (!ch || !('permissionOverwrites' in ch)) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'À faire dans un salon de ticket.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const user = interaction.options.getUser('membre', true);
    await ch.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
    await interaction.reply({ embeds: [successEmbed('Membre ajouté', `<@${user.id}> a été ajouté au ticket.`)] });
  },
};

/** /remove <membre> — retire un membre du ticket (salon) actuel. */
export const ticketRemove: SlashCommand = {
  minLevel: GRADES.modo.level,
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Retire un membre du ticket actuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption((o) => o.setName('membre').setDescription('Le membre à retirer').setRequired(true)),
  async execute(interaction) {
    const ch = interaction.channel as TextChannel | null;
    if (!ch || !('permissionOverwrites' in ch)) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'À faire dans un salon de ticket.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const user = interaction.options.getUser('membre', true);
    await ch.permissionOverwrites.delete(user.id).catch(() => {});
    await interaction.reply({ embeds: [successEmbed('Membre retiré', `<@${user.id}> a été retiré du ticket.`)] });
  },
};
