import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, type TextChannel } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { spoilerPanelEmbed, spoilerButtons } from '../../lib/spoilers.js';

/** Poste le panneau "Centre des spoilers" dans le salon courant (admin+). */
export const setupSpoilers: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('setup-spoilers')
    .setDescription('Poster le panneau des spoilers (parrainage) dans ce salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  minLevel: GRADES.admin.level,
  async execute(interaction) {
    const channel = interaction.channel as TextChannel | null;
    if (!channel?.isTextBased()) {
      await interaction.reply({ embeds: [errorEmbed('Erreur', 'Salon invalide.')], flags: MessageFlags.Ephemeral });
      return;
    }
    await channel.send({ embeds: [spoilerPanelEmbed()], components: [spoilerButtons()] });
    await interaction.reply({ embeds: [successEmbed('Panneau posté', 'Le Centre des spoilers a été affiché.')], flags: MessageFlags.Ephemeral });
  },
};
