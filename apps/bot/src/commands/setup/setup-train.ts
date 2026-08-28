import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { CHANNELS, GRADES } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { controlPanel } from '../../lib/train.js';

export const setupTrain: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('setup-train')
    .setDescription('Poster le panneau d’entraînement modération (salon train modo)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = await interaction.client.channels
      .fetch(CHANNELS.trainModo)
      .catch(() => null);
    if (!channel?.isTextBased()) {
      await interaction.editReply({
        embeds: [errorEmbed('Salon introuvable', 'Le salon « train modo » est introuvable.')],
      });
      return;
    }

    const { embeds, components } = controlPanel(false);
    await (channel as TextChannel).send({ embeds, components });
    await interaction.editReply({
      embeds: [successEmbed('Publié', 'Le panneau d’entraînement a été posté.')],
    });
  },
};
