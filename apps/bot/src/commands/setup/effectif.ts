import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { CHANNELS, GRADES, BRAND_COLOR } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

// Ordre d'affichage (du plus haut au plus bas). Logos/emojis : plus tard.
const ORDER = ['fondateur', 'cofondateur', 'responsable', 'admin', 'dev', 'buildeur', 'com'];

/**
 * Publie l'Effectif du staff (embed) dans le salon accueil.
 * Actifs = membres ayant le rôle. Absents = absences actives en base.
 * (Demain : temps réel via le site.)
 */
export const effectif: SlashCommand = {
  founderOnly: true,
  data: new SlashCommandBuilder()
    .setName('effectif')
    .setDescription("Publier l'effectif du staff dans le salon accueil")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const guild = interaction.guild;
    if (!guild) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Serveur introuvable.')] });
      return;
    }

    await guild.members.fetch();

    // Set des discord_id en absence (base)
    const absentIds = new Set<string>();
    if (hasDatabase()) {
      const rows = await db()<{ discord_id: string }[]>`
        select discord_id from absences where status = 'active'
      `.catch(() => [] as { discord_id: string }[]);
      for (const r of rows) absentIds.add(r.discord_id);
    }

    const lines: string[] = [];
    for (const key of ORDER) {
      const g = GRADES[key as keyof typeof GRADES];
      if (!g?.roleId) continue;
      const role = guild.roles.cache.get(g.roleId);
      const members = role ? [...role.members.values()] : [];
      const actifs = members.filter((m) => !absentIds.has(m.id));
      const absents = members.filter((m) => absentIds.has(m.id));

      lines.push(`**${g.label} (${members.length}) :**`);
      lines.push(actifs.length ? actifs.map((m) => m.displayName).join(', ') : '---');
      if (absents.length) {
        lines.push(`⏰ **Absent :** ${absents.map((m) => m.displayName).join(', ')}`);
      }
      lines.push('');
    }

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('Effectif du staff')
      .setDescription(lines.join('\n') || '*Aucun staff.*');

    const channel = await interaction.client.channels.fetch(CHANNELS.accueil).catch(() => null);
    if (!channel?.isTextBased()) {
      await interaction.editReply({
        embeds: [errorEmbed('Salon introuvable', 'Le salon accueil est introuvable.')],
      });
      return;
    }

    await (channel as TextChannel).send({ embeds: [embed] });
    await interaction.editReply({
      embeds: [successEmbed('Effectif publié', "L'effectif a été posté dans le salon accueil.")],
    });
  },
};
