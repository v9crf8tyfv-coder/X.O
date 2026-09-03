import { MessageFlags, type ButtonInteraction } from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { BTN_VIEW, BTN_INVITES, viewNextSpoiler, myInvitesEmbed } from '../lib/spoilers.js';

/** Bouton « Voir un spoiler » — débloque/affiche le prochain spoiler (privé). */
export const spoilerView: ComponentHandler<ButtonInteraction> = {
  prefix: BTN_VIEW,
  async execute(interaction) {
    const embed = await viewNextSpoiler(interaction.user.id);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

/** Bouton « Mes invitations » — statistiques privées. */
export const spoilerInvites: ComponentHandler<ButtonInteraction> = {
  prefix: BTN_INVITES,
  async execute(interaction) {
    const embed = await myInvitesEmbed(interaction.user.id);
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
