import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

/** Définit le salon vocal "➕ Créer son Salon" (join-to-create). */
export const setupVoice: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('setup-voice')
    .setDescription('Définit le salon vocal "Créer son Salon" (join-to-create)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption((o) =>
      o
        .setName('salon')
        .setDescription('Le salon vocal "➕ Créer son Salon"')
        .addChannelTypes(ChannelType.GuildVoice)
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    if (!hasDatabase()) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Pas de base de données.')] });
      return;
    }
    const ch = interaction.options.getChannel('salon', true);
    await db()`
      insert into bot_state (key, value) values ('voice_creator', ${ch.id})
      on conflict (key) do update set value = excluded.value
    `;
    await interaction.editReply({
      embeds: [
        successEmbed(
          'Salon vocal configuré',
          `Rejoindre <#${ch.id}> créera automatiquement un salon perso (supprimé quand il est vide).`,
        ),
      ],
    });
  },
};
