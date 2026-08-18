import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import { GRADES } from '@xo/shared';
import type { SlashCommand } from '../../types.js';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

export const removeall: SlashCommand = {
  minLevel: GRADES.responsable.level, // au-dessus d'admin (caché aux admins)
  data: new SlashCommandBuilder()
    .setName('removeall')
    .setDescription('Supprimer TOUS les messages récents (< 14 jours) de ce salon')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const channel = interaction.channel as TextChannel | null;
    if (!channel) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Salon introuvable.')] });
      return;
    }

    let total = 0;
    // Boucle : supprime par lots de 100 tant qu'il en reste (< 14 jours)
    for (let i = 0; i < 50; i++) {
      const deleted = await channel.bulkDelete(100, true).catch(() => null);
      if (!deleted || deleted.size === 0) break;
      total += deleted.size;
      if (deleted.size < 100) break;
    }

    await interaction.editReply({
      embeds: [
        successEmbed(
          'Salon nettoyé',
          `${total} message(s) supprimé(s).\n*(Les messages de plus de 14 jours ne peuvent pas être supprimés en masse par Discord.)*`,
        ),
      ],
    });
  },
};
