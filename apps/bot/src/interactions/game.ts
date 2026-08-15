import { MessageFlags, type ButtonInteraction } from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { successEmbed } from '../lib/embeds.js';

/** Boutons « Launcher <OS> » tant qu'aucun lien de téléchargement n'est configuré */
export const launcherSoon: ComponentHandler<ButtonInteraction> = {
  prefix: 'launcher:soon',
  async execute(interaction) {
    await interaction.reply({
      embeds: [successEmbed('Bientôt', 'Le launcher EmeriaMC arrive très prochainement.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
