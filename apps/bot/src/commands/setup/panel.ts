import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  RoleSelectMenuBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { BRAND_COLOR } from '@xo/shared';
import { successEmbed } from '../../lib/embeds.js';

export const panel: SlashCommand = {
  founderOnly: true,
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Faire apparaître le panneau de configuration')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('⚙️ Panel de configuration')
      .setDescription(
        'Sélectionne le(s) **rôle(s)** attribué(s) automatiquement à chaque membre ' +
          'qui rejoint le serveur.',
      )
      .setFooter({ text: 'X.O • Configuration' });

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId('panel:autorole')
        .setPlaceholder('Choisir le(s) rôle(s) automatique(s)')
        .setMinValues(0)
        .setMaxValues(5),
    );

    await (interaction.channel as TextChannel).send({
      embeds: [embed],
      components: [row],
    });

    await interaction.editReply({
      embeds: [successEmbed('Panel affiché', 'Le panneau a été posté dans ce salon.')],
    });
  },
};
