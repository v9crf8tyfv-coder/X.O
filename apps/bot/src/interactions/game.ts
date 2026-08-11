import { MessageFlags, type ButtonInteraction } from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { successEmbed } from '../lib/embeds.js';

/** Bouton « SITE » de l'embed Lancer le jeu, tant qu'aucune URL n'est configurée */
export const gameSiteSoon: ComponentHandler<ButtonInteraction> = {
  prefix: 'game:site:soon',
  async execute(interaction) {
    await interaction.reply({
      embeds: [successEmbed('Bientôt', 'Le site du serveur arrive très prochainement.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
