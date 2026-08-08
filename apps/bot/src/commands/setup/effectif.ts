import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { CHANNELS, GRADES } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

// Emojis basiques par grade (à remplacer par les vraies icônes de rôle plus tard)
const EMOJI: Record<string, string> = {
  fondateur: '👑',
  cofondateur: '⭐',
  responsable: '🛡️',
  admin: '🅰️',
  dev: '💻',
  buildeur: '🏗️',
  com: '📢',
};
// Ordre d'affichage (du plus haut au plus bas)
const ORDER = ['fondateur', 'cofondateur', 'responsable', 'admin', 'dev', 'buildeur', 'com'];

/**
 * Publie l'Effectif du staff dans le salon accueil.
 * Version actuelle : lit les rôles Discord en direct.
 * (Demain : branché sur la base + mise à jour temps réel via le site.)
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

    await guild.members.fetch(); // s'assurer que tous les membres sont en cache

    const lines: string[] = ['# 📋 Effectif du staff', ''];
    for (const key of ORDER) {
      const g = GRADES[key as keyof typeof GRADES];
      if (!g?.roleId) continue;
      const role = guild.roles.cache.get(g.roleId);
      const members = role ? [...role.members.values()] : [];
      lines.push(`${EMOJI[key] ?? '•'} **${g.label} (${members.length}) :**`);
      lines.push(members.length ? members.map((m) => m.displayName).join(', ') : '---');
      lines.push('');
    }

    const channel = await interaction.client.channels.fetch(CHANNELS.accueil).catch(() => null);
    if (!channel?.isTextBased()) {
      await interaction.editReply({
        embeds: [errorEmbed('Salon introuvable', 'Le salon accueil est introuvable.')],
      });
      return;
    }

    await (channel as TextChannel).send({ content: lines.join('\n') });
    await interaction.editReply({
      embeds: [successEmbed('Effectif publié', "L'effectif a été posté dans le salon accueil.")],
    });
  },
};
