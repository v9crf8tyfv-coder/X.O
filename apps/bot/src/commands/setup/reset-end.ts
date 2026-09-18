import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { resetEmbed, postReset } from '../../lib/resetAnnounce.js';
import { successEmbed } from '../../lib/embeds.js';

/**
 * /resetend — annonce le reset de l'End dans le salon Annonce (petit embed).
 * L'End ne se reset pas automatiquement (pas de date prévisible) → déclenché à la main
 * par un fondateur (Orionyx84 / ilian0800).
 */
export const resetEnd: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('resetend')
    .setDescription("Annoncer le reset de l'End dans le salon Annonce")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await postReset(interaction.client, resetEmbed('Reset Mensuel — End !', "L'**End** vient d'être reset à **l'instant** !"), 'end');
    await interaction.reply({
      embeds: [successEmbed('Annonce postée', "Le reset de l'End a été annoncé dans le salon Annonce.")],
      flags: MessageFlags.Ephemeral,
    });
  },
};
