import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { successEmbed } from '../../lib/embeds.js';

const STATUT_ROLE = '1540339127784968293';

/** Poste un menu de rôles à cliquer (bouton = on prend/retire le rôle). */
export const setupRoles: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('setup-roles')
    .setDescription('Poster le menu de rôles (clic = prendre/retirer le rôle)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle('🎭 Choisis tes rôles')
      .setColor(0x8b5cf6)
      .setDescription(
        'Clique sur un bouton pour **prendre** ou **retirer** un rôle.\n\n' +
          '🛠️ **Statut** — être notifié quand le serveur ouvre/ferme',
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`rolebtn:${STATUT_ROLE}`)
        .setLabel('Statut')
        .setEmoji('🛠️')
        .setStyle(ButtonStyle.Secondary),
    );

    await (interaction.channel as TextChannel)?.send({ embeds: [embed], components: [row] });
    await interaction.reply({
      embeds: [successEmbed('Menu de rôles posté', 'Les membres peuvent maintenant cliquer pour obtenir leurs rôles.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
