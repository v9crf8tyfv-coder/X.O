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
import { CHANNELS, BRAND_COLOR, GRADES } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

// Image (bannière) affichée sous l'embed — configurable via .env → GAME_BANNER_URL
const BANNER_URL = process.env.GAME_BANNER_URL ?? '';
const SITE_URL = process.env.SITE_URL ?? 'https://x-o-web.vercel.app';

export const setupLancerJeu: SlashCommand = {
  minLevel: GRADES.fondateur.level, // fondateurs uniquement
  data: new SlashCommandBuilder()
    .setName('setup-lancer-lejeu')
    .setDescription('Poster l’embed « Lancer le jeu » dans le salon dédié')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = await interaction.client.channels.fetch(CHANNELS.lancerJeu).catch(() => null);
    if (!channel?.isTextBased()) {
      await interaction.editReply({
        embeds: [errorEmbed('Salon introuvable', 'Le salon « lancer le jeu » est introuvable.')],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🎮 Lancer le jeu')
      .setDescription(
        'Voici comment rejoindre le serveur.\n' +
          '*(Les étapes exactes seront ajoutées quand le serveur Minecraft sera prêt.)*',
      );
    if (BANNER_URL) embed.setImage(BANNER_URL);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('Aller au site').setStyle(ButtonStyle.Link).setURL(SITE_URL),
    );

    await (channel as TextChannel).send({ embeds: [embed], components: [row] });
    await interaction.editReply({
      embeds: [successEmbed('Publié', 'L’embed « Lancer le jeu » a été posté.')],
    });
  },
};
