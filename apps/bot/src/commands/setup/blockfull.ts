import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
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

/** Verrouille TOUT le site (personne ne peut y accéder). Responsable et +. */
export const blockfull: SlashCommand = {
  minLevel: GRADES.responsable.level,
  data: new SlashCommandBuilder()
    .setName('blockfull')
    .setDescription('Verrouiller TOTALEMENT le site')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // caché aux admins
  async execute(interaction) {
    const ok = await setBlocked(true);
    await interaction.reply({
      embeds: ok
        ? [successEmbed('🔒 Site verrouillé', 'Tout accès au site est bloqué. Rien n\'est supprimé.')]
        : [errorEmbed('Erreur', 'Base non configurée.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};

/** Déverrouille le site. Responsable et +. */
export const unblockfull: SlashCommand = {
  minLevel: GRADES.responsable.level,
  data: new SlashCommandBuilder()
    .setName('unblockfull')
    .setDescription('Déverrouiller le site')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // caché aux admins
  async execute(interaction) {
    const ok = await setBlocked(false);
    await interaction.reply({
      embeds: ok
        ? [successEmbed('🔓 Site déverrouillé', 'Le site est de nouveau accessible.')]
        : [errorEmbed('Erreur', 'Base non configurée.')],
      flags: MessageFlags.Ephemeral,
    });
  },
};
