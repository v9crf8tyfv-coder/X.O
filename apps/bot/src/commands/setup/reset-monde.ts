import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { resetEmbed, postReset } from '../../lib/resetAnnounce.js';
import { successEmbed } from '../../lib/embeds.js';

/**
 * /resetmonde — poste l'annonce du reset Mine + Nether dans le salon Annonce.
 * (La même est postée automatiquement chaque jeudi 08h30 ; cette commande permet
 * de la déclencher/prévisualiser à la demande.)
 */
export const resetMonde: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('resetmonde')
    .setDescription('Annoncer le reset Mine + Nether dans le salon Annonce')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await postReset(
      interaction.client,
      resetEmbed('Reset Semestriel, Nether et Mine !', "Le monde **Mine** et le **Nether** viennent d'être reset !"),
    );
    await interaction.reply({
      embeds: [successEmbed('Annonce postée', 'Le reset Mine + Nether a été annoncé dans le salon Annonce.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
