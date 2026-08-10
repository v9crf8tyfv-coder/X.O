import { SlashCommandBuilder, MessageFlags, type GuildMember } from 'discord.js';
import { GRADES } from '@xo/shared';
import type { SlashCommand } from '../../types.js';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { recordSanction } from '../../lib/sanctions.js';

export const ban: SlashCommand = {
  minLevel: GRADES.admin.level, // ban = admin et au-dessus
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bannir un membre du serveur')
    .addUserOption((o) =>
      o.setName('membre').setDescription('Le membre à bannir').setRequired(true),
    )
    .addStringOption((o) =>
      o.setName('raison').setDescription('Raison du ban').setRequired(false),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser('membre', true);
    const raison = interaction.options.getString('raison') ?? 'Aucune raison';
    const member = interaction.options.getMember('membre') as GuildMember | null;

    if (member && !member.bannable) {
      await interaction.editReply({
        embeds: [errorEmbed('Impossible', `Je ne peux pas bannir ${user.tag}.`)],
      });
      return;
    }

    await interaction.guild?.members.ban(user.id, { reason: raison });
    await recordSanction({
      targetPseudo: user.tag,
      type: 'ban',
      reason: raison,
      issuedBy: interaction.user.tag,
    });

    await interaction.editReply({
      embeds: [
        successEmbed(
          'Membre banni',
          `**${user.tag}** a été banni.\n**Raison :** ${raison}`,
        ),
      ],
    });
  },
};
