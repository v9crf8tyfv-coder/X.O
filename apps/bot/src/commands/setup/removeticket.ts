import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { errorEmbed, successEmbed } from '../../lib/embeds.js';
import { finalizeClose } from '../../interactions/ticket.js';

/**
 * /removeticket — ferme et ARCHIVE le ticket courant (récap + transcription dans le salon
 * d'archives), puis supprime le salon. Même mécanique que le bouton "Fermer".
 */
export const removeTicket: SlashCommand = {
  minLevel: GRADES.modo.level,
  data: new SlashCommandBuilder()
    .setName('removeticket')
    .setDescription('Ferme et archive le ticket actuel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const channel = interaction.channel as TextChannel | null;
    if (!channel || channel.type !== ChannelType.GuildText) {
      await interaction.reply({
        embeds: [errorEmbed('Erreur', 'À faire dans un salon de ticket.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Sécurité : on ne supprime que de vrais tickets (présents en base, ou nommés comme tel).
    let isTicket = /ticket|escalade/i.test(channel.name);
    if (!isTicket && hasDatabase()) {
      const rows = await db()`select 1 from tickets where channel_id = ${channel.id}`.catch(() => []);
      isTicket = rows.length > 0;
    }
    if (!isTicket) {
      await interaction.reply({
        embeds: [errorEmbed('Pas un ticket', "Ce salon n'est pas un ticket.")],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply({
      embeds: [
        successEmbed(
          'Fermeture…',
          'Archivage en cours, le ticket sera supprimé dans quelques secondes.',
        ),
      ],
    });
    await finalizeClose(interaction.client, channel, interaction.user.tag);
  },
};
