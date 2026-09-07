import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import { GRADES } from '@xo/shared';
import type { SlashCommand } from '../../types.js';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { buildEntreeMessage } from '../../lib/entree.js';

/** Publie le panneau "Comment as-tu connu EmeriaMC ?" dans le salon courant (fondateurs). */
export const setupEntree: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('setup-entree')
    .setDescription("Publie le panneau d'entrée (Comment as-tu connu EmeriaMC ?) dans ce salon")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const channel = interaction.channel as TextChannel | null;
    if (!channel) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'Salon introuvable.')], flags: MessageFlags.Ephemeral });
      return;
    }
    await channel.send(buildEntreeMessage());
    await interaction.reply({
      embeds: [successEmbed('Publié', "Le panneau d'entrée a été publié dans ce salon.")],
      flags: MessageFlags.Ephemeral,
    });
  },
};
