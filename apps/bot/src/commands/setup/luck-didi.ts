import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

/**
 * /luckdidi — VERROUILLE le Discord : personne ne peut plus rejoindre, par AUCUN moyen
 * (liens d'invitation, URL vanity, widget, découverte). Utilise la "Pause des invitations"
 * native de Discord. /unluckdidi rouvre. Fondateurs uniquement.
 */
async function setLock(guildLock: boolean, interaction: Parameters<SlashCommand['execute']>[0]): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({ embeds: [errorEmbed('Erreur', 'Commande à lancer sur un serveur.')], flags: MessageFlags.Ephemeral });
    return;
  }
  try {
    await guild.disableInvites(guildLock);
    await interaction.reply({
      embeds: [
        successEmbed(
          guildLock ? '🔒 Discord verrouillé' : '🔓 Discord déverrouillé',
          guildLock
            ? 'Plus personne ne peut rejoindre — invitations, URL vanity, widget et découverte sont désactivés.'
            : 'Les invitations sont réactivées : on peut de nouveau rejoindre.',
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  } catch (e) {
    await interaction.reply({
      embeds: [errorEmbed('Échec', 'Impossible de modifier les invitations (le bot a-t-il la permission « Gérer le serveur » ?).')],
      flags: MessageFlags.Ephemeral,
    });
    console.error('[luckdidi]', e);
  }
}

export const luckDidi: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('luckdidi')
    .setDescription('Verrouiller le Discord : plus personne ne peut rejoindre')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: (interaction) => setLock(true, interaction),
};

export const unluckDidi: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('unluckdidi')
    .setDescription('Déverrouiller le Discord : on peut de nouveau rejoindre')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  execute: (interaction) => setLock(false, interaction),
};
