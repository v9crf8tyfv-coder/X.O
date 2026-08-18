import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import { GRADES } from '@xo/shared';
import type { SlashCommand } from '../../types.js';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

export const removemess: SlashCommand = {
  minLevel: GRADES.responsable.level, // au-dessus d'admin (caché aux admins)
  data: new SlashCommandBuilder()
    .setName('removemess')
    .setDescription('Supprimer un certain nombre de messages dans ce salon')
    .addIntegerOption((o) =>
      o
        .setName('nombre')
        .setDescription('Nombre de messages à supprimer (1 à 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const nombre = interaction.options.getInteger('nombre', true);
    const channel = interaction.channel as TextChannel | null;
    if (!channel) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Salon introuvable.')] });
      return;
    }
    // bulkDelete ignore les messages > 14 jours (filtre auto = true)
    const deleted = await channel.bulkDelete(nombre, true).catch(() => null);
    if (!deleted) {
      await interaction.editReply({
        embeds: [errorEmbed('Impossible', 'Messages trop vieux (>14j) ou permissions manquantes.')],
      });
      return;
    }
    await interaction.editReply({
      embeds: [successEmbed('Nettoyé', `${deleted.size} message(s) supprimé(s).`)],
    });
  },
};
