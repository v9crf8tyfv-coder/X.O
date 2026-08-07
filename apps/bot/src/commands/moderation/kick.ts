import {
  SlashCommandBuilder,
  MessageFlags,
  PermissionFlagsBits,
  type GuildMember,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { recordSanction } from '../../lib/sanctions.js';

export const kick: SlashCommand = {
  founderOnly: true,
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulser un membre du serveur')
    .addUserOption((o) =>
      o.setName('membre').setDescription('Le membre à expulser').setRequired(true),
    )
    .addStringOption((o) =>
      o.setName('raison').setDescription("Raison de l'expulsion").setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  async execute(interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser('membre', true);
    const raison = interaction.options.getString('raison') ?? 'Aucune raison';
    const member = interaction.options.getMember('membre') as GuildMember | null;

    if (!member) {
      await interaction.editReply({
        embeds: [errorEmbed('Introuvable', "Ce membre n'est pas sur le serveur.")],
      });
      return;
    }
    if (!member.kickable) {
      await interaction.editReply({
        embeds: [errorEmbed('Impossible', `Je ne peux pas expulser ${user.tag}.`)],
      });
      return;
    }

    await member.kick(raison);
    await recordSanction({
      targetPseudo: user.tag,
      type: 'kick',
      reason: raison,
      issuedBy: interaction.user.tag,
    });

    await interaction.editReply({
      embeds: [
        successEmbed(
          'Membre expulsé',
          `**${user.tag}** a été expulsé.\n**Raison :** ${raison}`,
        ),
      ],
    });
  },
};
