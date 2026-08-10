import { SlashCommandBuilder, MessageFlags, type GuildMember } from 'discord.js';
import { GRADES } from '@xo/shared';
import type { SlashCommand } from '../../types.js';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { recordSanction } from '../../lib/sanctions.js';
import { parseDuration } from '../../lib/duration.js';

const MAX_TIMEOUT = 28 * 86_400_000; // 28 jours (limite Discord)

export const mute: SlashCommand = {
  minLevel: GRADES.modo.level, // modo et au-dessus
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Réduire au silence un membre (timeout)')
    .addUserOption((o) =>
      o.setName('membre').setDescription('Le membre à muter').setRequired(true),
    )
    .addStringOption((o) =>
      o
        .setName('duree')
        .setDescription('Durée : 10m, 2h, 7d… (max 28d)')
        .setRequired(true),
    )
    .addStringOption((o) =>
      o.setName('raison').setDescription('Raison du mute').setRequired(false),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const user = interaction.options.getUser('membre', true);
    const dureeStr = interaction.options.getString('duree', true);
    const raison = interaction.options.getString('raison') ?? 'Aucune raison';
    const member = interaction.options.getMember('membre') as GuildMember | null;

    const ms = parseDuration(dureeStr);
    if (!ms || ms > MAX_TIMEOUT) {
      await interaction.editReply({
        embeds: [
          errorEmbed('Durée invalide', 'Utilise : `10m`, `2h`, `7d`… (max `28d`).'),
        ],
      });
      return;
    }
    if (!member?.moderatable) {
      await interaction.editReply({
        embeds: [errorEmbed('Impossible', `Je ne peux pas muter ${user.tag}.`)],
      });
      return;
    }

    await member.timeout(ms, raison);
    await recordSanction({
      targetPseudo: user.tag,
      type: 'tempmute',
      reason: raison,
      duration: dureeStr,
      issuedBy: interaction.user.tag,
    });

    await interaction.editReply({
      embeds: [
        successEmbed(
          'Membre muté',
          `**${user.tag}** est mute pour **${dureeStr}**.\n**Raison :** ${raison}`,
        ),
      ],
    });
  },
};
