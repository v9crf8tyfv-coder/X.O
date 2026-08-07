import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { successEmbed } from '../../lib/embeds.js';
import { recordSanction } from '../../lib/sanctions.js';

export const warn: SlashCommand = {
  founderOnly: true,
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Avertir un membre')
    .addUserOption((o) =>
      o.setName('membre').setDescription('Le membre à avertir').setRequired(true),
    )
    .addStringOption((o) =>
      o.setName('raison').setDescription("Raison de l'avertissement").setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  async execute(interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser('membre', true);
    const raison = interaction.options.getString('raison', true);

    await recordSanction({
      targetPseudo: user.tag,
      type: 'warn',
      reason: raison,
      issuedBy: interaction.user.tag,
    });

    // Tentative de DM au membre
    await user
      .send(`⚠️ Tu as reçu un avertissement sur le serveur.\n**Raison :** ${raison}`)
      .catch(() => {});

    await interaction.editReply({
      embeds: [
        successEmbed('Membre averti', `**${user.tag}** a été averti.\n**Raison :** ${raison}`),
      ],
    });
  },
};
