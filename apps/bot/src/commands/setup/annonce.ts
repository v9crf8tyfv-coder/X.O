import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { startAnnounce, stopAnnounce } from '../../lib/announceState.js';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

export const annonceStart: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('annoncestart')
    .setDescription('Active le mode annonce : tes messages ici seront postés par le bot')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // caché aux admins
  async execute(interaction) {
    if (!interaction.channelId) {
      await interaction.reply({
        embeds: [errorEmbed('Erreur', 'Salon introuvable.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    startAnnounce(interaction.user.id, interaction.channelId);
    await interaction.reply({
      embeds: [
        successEmbed(
          '📢 Mode annonce activé',
          'Tout ce que tu écris **dans ce salon** sera reposté par le bot (ton message est supprimé). Fais `/annoncestop` pour arrêter.',
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};

export const annonceStop: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('annoncestop')
    .setDescription('Désactive le mode annonce')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // caché aux admins
  async execute(interaction) {
    const was = stopAnnounce(interaction.user.id);
    await interaction.reply({
      embeds: [
        was
          ? successEmbed('Mode annonce désactivé', 'Tes messages sont de nouveau normaux.')
          : errorEmbed('Rien à arrêter', "Tu n'étais pas en mode annonce."),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
