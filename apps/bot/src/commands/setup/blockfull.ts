import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { OWNER_DISCORD_ID } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

async function setBlocked(value: boolean): Promise<boolean> {
  if (!hasDatabase()) return false;
  await db()`
    insert into bot_state (key, value) values ('site_blocked', ${value ? '1' : '0'})
    on conflict (key) do update set value = ${value ? '1' : '0'}, updated_at = now()
  `;
  return true;
}

/** Verrouille TOUT le site (personne ne peut y accéder, même le proprio). */
export const blockfull: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('blockfull')
    .setDescription('Verrouiller TOTALEMENT le site (proprio uniquement)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // caché aux admins
  async execute(interaction) {
    if (interaction.user.id !== OWNER_DISCORD_ID) {
      await interaction.reply({
        embeds: [errorEmbed('Refusé', 'Commande réservée au propriétaire.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const ok = await setBlocked(true);
    await interaction.reply({
      embeds: ok
        ? [successEmbed('🔒 Site verrouillé', 'Tout accès au site est bloqué (même toi). Rien n\'est supprimé.')]
        : [errorEmbed('Erreur', 'Base non configurée.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};

/** Déverrouille le site. */
export const unblockfull: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('unblockfull')
    .setDescription('Déverrouiller le site (proprio uniquement)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // caché aux admins
  async execute(interaction) {
    if (interaction.user.id !== OWNER_DISCORD_ID) {
      await interaction.reply({
        embeds: [errorEmbed('Refusé', 'Commande réservée au propriétaire.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const ok = await setBlocked(false);
    await interaction.reply({
      embeds: ok
        ? [successEmbed('🔓 Site déverrouillé', 'Le site est de nouveau accessible.')]
        : [errorEmbed('Erreur', 'Base non configurée.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
