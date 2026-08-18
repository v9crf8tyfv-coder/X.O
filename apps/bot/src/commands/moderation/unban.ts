import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { GRADES } from '@xo/shared';
import type { SlashCommand } from '../../types.js';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

export const unban: SlashCommand = {
  minLevel: GRADES.responsable.level, // au-dessus d'admin
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Débannir un membre (par son ID Discord)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // caché aux admins
    .addStringOption((o) =>
      o.setName('id').setDescription("ID de l'utilisateur à débannir").setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const id = interaction.options.getString('id', true);
    try {
      await interaction.guild?.bans.remove(id, `Débannissement par ${interaction.user.tag}`);
      await interaction.editReply({
        embeds: [successEmbed('Membre débanni', `<@${id}> (\`${id}\`) a été débanni.`)],
      });
    } catch {
      await interaction.editReply({
        embeds: [errorEmbed('Impossible', 'ID invalide ou membre non banni.')],
      });
    }
  },
};
