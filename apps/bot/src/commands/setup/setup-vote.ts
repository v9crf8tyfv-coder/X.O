import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { successEmbed } from '../../lib/embeds.js';
import { publishVoteBoard } from '../../lib/voteBoard.js';

/** Poste (ou déplace) l'embed du classement des votes dans le salon courant. Auto-actualisé. */
export const setupVote: SlashCommand = {
  minLevel: GRADES.cofondateur.level,
  data: new SlashCommandBuilder()
    .setName('setup-vote')
    .setDescription('Poster le classement des votes (top 3) dans ce salon, auto-actualisé')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await publishVoteBoard(interaction.client, interaction.channelId);
    await interaction.editReply({
      embeds: [
        successEmbed(
          'Classement des votes',
          'Embed posté dans ce salon. Il se met à jour automatiquement (toutes les 5 min).',
        ),
      ],
    });
  },
};
