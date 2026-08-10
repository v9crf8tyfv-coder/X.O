import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { CHANNELS } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { buildCategorySelect, buildTicketPanelEmbed, type TicketSpace } from '../../lib/tickets.js';

export const setupTicket: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('setup-ticket')
    .setDescription('Poster le panneau de tickets')
    .addStringOption((o) =>
      o
        .setName('espace')
        .setDescription('Quel panneau de tickets')
        .setRequired(true)
        .addChoices(
          { name: 'Staff', value: 'staff' },
          { name: 'Joueurs (normal)', value: 'normal' },
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const space = interaction.options.getString('espace', true) as TicketSpace;
    const channelId = space === 'staff' ? CHANNELS.ticketStaff : CHANNELS.ticketNormal;

    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) {
      await interaction.editReply({
        embeds: [errorEmbed('Salon introuvable', 'Le salon de tickets est introuvable.')],
      });
      return;
    }

    await (channel as TextChannel).send({
      embeds: [buildTicketPanelEmbed(space)],
      components: [buildCategorySelect(space)],
    });
    await interaction.editReply({
      embeds: [successEmbed('Panneau posté', `Panneau tickets **${space}** affiché.`)],
    });
  },
};
