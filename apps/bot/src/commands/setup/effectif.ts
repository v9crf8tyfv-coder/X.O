import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { hasDatabase } from '@xo/db';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { publishEffectif } from '../../lib/effectifPublish.js';

/**
 * Publie (ou met à jour) l'Effectif du staff dans le salon accueil.
 * Basé sur la table `staff` (pseudos Minecraft reliés via le site).
 */
export const effectif: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('effectif')
    .setDescription("Publier / actualiser l'effectif du staff dans le salon accueil")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!hasDatabase()) {
      await interaction.editReply({
        embeds: [errorEmbed('Base requise', "L'effectif a besoin de la base de données.")],
      });
      return;
    }
    await publishEffectif(interaction.client);
    await interaction.editReply({
      embeds: [successEmbed('Effectif publié', 'Le message a été posté / mis à jour dans accueil.')],
    });
  },
};
