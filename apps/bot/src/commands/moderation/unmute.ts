import { SlashCommandBuilder, MessageFlags, type GuildMember } from 'discord.js';
import { GRADES } from '@xo/shared';
import type { SlashCommand } from '../../types.js';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

export const unmute: SlashCommand = {
  minLevel: GRADES.responsable.level, // au-dessus d'admin
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Retirer le mute (timeout) d\'un membre')
    .addUserOption((o) =>
      o.setName('membre').setDescription('Le membre à démuter').setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser('membre', true);
    const member = interaction.options.getMember('membre') as GuildMember | null;

    if (!member) {
      await interaction.editReply({
        embeds: [errorEmbed('Introuvable', "Ce membre n'est pas sur le serveur.")],
      });
      return;
    }

    await member.timeout(null);
    await interaction.editReply({
      embeds: [successEmbed('Mute retiré', `**${user.tag}** peut de nouveau parler.`)],
    });
  },
};
