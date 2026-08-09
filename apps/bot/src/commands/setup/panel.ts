import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  MessageFlags,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { BRAND_COLOR } from '@xo/shared';

// URL du site (Vercel). Configurable via .env → SITE_URL
const SITE_URL = process.env.SITE_URL ?? 'https://x-o-web.vercel.app';

export const panel: SlashCommand = {
  founderOnly: true,
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Recevoir le lien du panel de gestion (fondateurs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🖥️ Panel X.O')
      .setDescription(
        'Voici le lien vers le **panel de gestion** du serveur.\n' +
          'Connecte-toi avec ton compte site pour y accéder.',
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('Ouvrir le panel').setStyle(ButtonStyle.Link).setURL(SITE_URL),
    );

    await interaction.reply({
      embeds: [embed],
      components: [row],
      flags: MessageFlags.Ephemeral,
    });
  },
};
