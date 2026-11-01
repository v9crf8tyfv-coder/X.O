import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
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
import { publishOrUpdatePanel } from '../../lib/panelMessage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Dépose l'image ici : apps/bot/assets/game-banner.png (elle s'affichera sous l'embed)
const BANNER_FILE = resolve(__dirname, '../../assets/game-banner.png');
const BANNER_URL = process.env.GAME_BANNER_URL ?? '';
// Liens de téléchargement du launcher (toujours la DERNIÈRE version publiée). Surchageables par env.
const REL = 'https://github.com/v9crf8tyfv-coder/EmeriaLauncher/releases/latest/download';
const LAUNCHER_WIN_URL = process.env.LAUNCHER_WIN_URL ?? `${REL}/EmeriaMC-windows.exe`;
const LAUNCHER_MAC_URL = process.env.LAUNCHER_MAC_URL ?? `${REL}/EmeriaMC-mac.dmg`;
const LAUNCHER_LINUX_URL = process.env.LAUNCHER_LINUX_URL ?? `${REL}/EmeriaMC-linux.AppImage`;

export const setupLancerJeu: SlashCommand = {
  minLevel: GRADES.responsable.level,
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

    const intro =
      '🚀 **Launcher EmeriaMC**\n\n' +
      'Chaque launcher te permettra d’installer et de lancer facilement le serveur avec la configuration nécessaire.\n\n' +
      '> Si tu rencontres un problème lors de **l’installation ou du lancement**, n’hésite pas à contacter notre équipe sur le **Support**.\n\n' +
      'Bon jeu et bienvenue sur Emeria !\n\n' +
      '> **<:EmeriaMC:1541095551511298139> L’équipe d\'EmeriaMC.**';

    // Bouton de téléchargement d'UN OS (lien si l'URL existe, sinon « à venir »).
    const dlBtn = (emoji: string, url: string, id: string) =>
      url
        ? new ButtonBuilder().setLabel('Télécharger').setEmoji(emoji).setStyle(ButtonStyle.Link).setURL(url)
        : new ButtonBuilder().setLabel('À venir').setEmoji(emoji).setStyle(ButtonStyle.Secondary).setCustomId(id).setDisabled(true);

    // Container Components V2 : UNE section par OS (titre + son bouton), séparées par une barre.
    const files: AttachmentBuilder[] = [];
    const container = new ContainerBuilder()
      .setAccentColor(BRAND_COLOR)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(intro));
    if (existsSync(BANNER_FILE)) {
      files.push(new AttachmentBuilder(BANNER_FILE, { name: 'banner.png' }));
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://banner.png')),
      );
    } else if (BANNER_URL) {
      container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(BANNER_URL)),
      );
    }
    const osSection = (label: string, emoji: string, url: string, id: string) => {
      container
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${label}** ${emoji}`))
        .addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(dlBtn(emoji, url, id)));
    };
    osSection('Launcher Windows', '🪟', LAUNCHER_WIN_URL, 'launcher:soon:win');
    osSection('Launcher macOS', '🍎', LAUNCHER_MAC_URL, 'launcher:soon:mac');
    osSection('Launcher Linux', '🐧', LAUNCHER_LINUX_URL, 'launcher:soon:linux');

    await publishOrUpdatePanel(channel as TextChannel, 'panel_lancer_jeu', { components: [container], files, flags: MessageFlags.IsComponentsV2 });
    await interaction.editReply({
      embeds: [successEmbed('À jour', 'L’embed « Lancer le jeu » a été mis à jour (ou posté).')],
    });
  },
};
