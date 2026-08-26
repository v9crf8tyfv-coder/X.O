import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, type TextChannel } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { postBoutiquePanel } from '../../interactions/boutique.js';

const BOUTIQUE_CHANNEL = '1538507381825077299';

/** Poste l'embed Boutique (bouton "Entrer mon code") dans le salon boutique. */
export const setupBoutique: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('setup-boutique')
    .setDescription("Poste l'embed Boutique (bouton pour entrer un code) dans le salon boutique")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const ch = await interaction.client.channels.fetch(BOUTIQUE_CHANNEL).catch(() => null);
    if (!ch || !ch.isTextBased()) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Salon boutique introuvable.')] });
      return;
    }
    await postBoutiquePanel(ch as TextChannel);
    await interaction.editReply({ embeds: [successEmbed('Boutique', 'Embed posté dans le salon boutique ✅')] });
  },
};
