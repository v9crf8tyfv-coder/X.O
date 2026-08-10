import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { SlashCommand } from '../../types.js';
import { CHANNELS, BRAND_COLOR, GRADES } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Dépose l'image ici : apps/bot/assets/game-banner.png (elle s'affichera sous l'embed)
const BANNER_FILE = resolve(__dirname, '../../assets/game-banner.png');
const BANNER_URL = process.env.GAME_BANNER_URL ?? '';
// Site du jeu (PAS le panel). Bouton affiché seulement quand ce site existera.
const GAME_SITE_URL = process.env.GAME_SITE_URL ?? '';
const JOUEUR_EMOJI = '<:Logojoueur:1536109797114515518>';

export const setupLancerJeu: SlashCommand = {
  minLevel: GRADES.fondateur.level,
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
      .setTitle('🎮 Jouer au serveur (PC)')
      .setDescription(
        'La version Java est accessible depuis PC.\n' +
          'Voici les étapes à suivre pour se connecter.\n\n' +
          `${JOUEUR_EMOJI} **Connexion via PC**\n` +
          "Lance le jeu Minecraft et connecte-toi au serveur grâce à l'IP ci-dessous en **1.21.1**.\n" +
          '```\nÀ venir ...\n```',
      );

    // Image : fichier local prioritaire, sinon URL, sinon rien
    const files: AttachmentBuilder[] = [];
    if (existsSync(BANNER_FILE)) {
      files.push(new AttachmentBuilder(BANNER_FILE, { name: 'banner.png' }));
      embed.setImage('attachment://banner.png');
    } else if (BANNER_URL) {
      embed.setImage(BANNER_URL);
    }

    // Bouton SITE : uniquement si le site du jeu est configuré (jamais le panel)
    const components = GAME_SITE_URL
      ? [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setLabel('SITE')
              .setEmoji('🌐')
              .setStyle(ButtonStyle.Link)
              .setURL(GAME_SITE_URL),
          ),
        ]
      : [];

    await (channel as TextChannel).send({ embeds: [embed], files, components });
    await interaction.editReply({
      embeds: [successEmbed('Publié', 'L’embed « Lancer le jeu » a été posté.')],
    });
  },
};
