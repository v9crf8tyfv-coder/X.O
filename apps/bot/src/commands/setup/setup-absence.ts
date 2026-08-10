import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { CHANNELS, BRAND_COLOR } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

export const setupAbsence: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('setup-absence')
    .setDescription('Poster le panneau des absences dans le salon absences')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = await interaction.client.channels
      .fetch(CHANNELS.absences)
      .catch(() => null);

    if (!channel?.isTextBased()) {
      await interaction.editReply({
        embeds: [errorEmbed('Salon introuvable', 'Le salon des absences est introuvable.')],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('📅 Absences')
      .setDescription(
        'Tu vas être absent ? Clique sur le bouton ci-dessous pour **poser une absence**.\n' +
          'Elle sera visible ici et tu passeras "en absence" dans l\'effectif du staff.',
      )
      .setFooter({ text: 'X.O • Absences' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('absence:new')
        .setLabel('Poser une absence')
        .setEmoji('📝')
        .setStyle(ButtonStyle.Primary),
    );

    await (channel as TextChannel).send({ embeds: [embed], components: [row] });
    await interaction.editReply({
      embeds: [successEmbed('Panneau posté', 'Le panneau des absences a été affiché.')],
    });
  },
};
