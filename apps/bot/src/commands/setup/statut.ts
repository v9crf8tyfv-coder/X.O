import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { successEmbed } from '../../lib/embeds.js';
import { postStatus } from '../../lib/serverStatus.js';

// Le statut est AUTOMATIQUE (le bot ping le serveur). Cette commande = forçage manuel (test).
export const statut: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('statut')
    .setDescription('Forcer le statut du serveur (normalement automatique)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((o) =>
      o
        .setName('etat')
        .setDescription('État du serveur')
        .setRequired(true)
        .addChoices({ name: 'OPEN', value: 'open' }, { name: 'CLOSE', value: 'close' }),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const isOpen = interaction.options.getString('etat', true) === 'open';
    await postStatus(interaction.client, isOpen);
    if (hasDatabase()) {
      await db()`
        insert into bot_state (key, value) values ('server_online', ${isOpen ? '1' : '0'})
        on conflict (key) do update set value = excluded.value
      `;
    }
    await interaction.editReply({
      embeds: [successEmbed('Statut forcé', `Serveur **${isOpen ? 'OPEN' : 'CLOSE'}**.`)],
    });
  },
};
