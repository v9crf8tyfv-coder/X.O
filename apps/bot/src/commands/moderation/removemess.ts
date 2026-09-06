import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  type TextChannel,
} from 'discord.js';
import { GRADES } from '@xo/shared';
import type { SlashCommand } from '../../types.js';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';

export const removemess: SlashCommand = {
  minLevel: GRADES.responsable.level, // au-dessus d'admin (caché aux admins)
  data: new SlashCommandBuilder()
    .setName('removemess')
    .setDescription('Supprimer un certain nombre de messages dans ce salon')
    .addIntegerOption((o) =>
      o
        .setName('nombre')
        .setDescription('Nombre de messages à supprimer (1 à 100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const nombre = interaction.options.getInteger('nombre', true);
    const channel = interaction.channel as TextChannel | null;
    if (!channel) {
      await interaction.editReply({ embeds: [errorEmbed('Erreur', 'Salon introuvable.')] });
      return;
    }

    // Récupère les N derniers messages, puis on gère les < 14j (bulk) et les ≥ 14j (un par un).
    const fetched = await channel.messages.fetch({ limit: nombre }).catch(() => null);
    if (!fetched || fetched.size === 0) {
      await interaction.editReply({
        embeds: [errorEmbed('Rien à supprimer', 'Aucun message trouvé (ou permissions manquantes).')],
      });
      return;
    }

    const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const recent = fetched.filter((m) => now - m.createdTimestamp < TWO_WEEKS && !m.pinned);
    const old = fetched.filter((m) => now - m.createdTimestamp >= TWO_WEEKS && !m.pinned);

    let count = 0;
    // 1) Récents (< 14j) : suppression groupée (rapide).
    if (recent.size >= 2) {
      const del = await channel.bulkDelete(recent, true).catch(() => null);
      count += del?.size ?? 0;
    } else if (recent.size === 1) {
      if (await recent.first()!.delete().then(() => true).catch(() => false)) count++;
    }
    // 2) Vieux (≥ 14j) : un par un (discord.js gère la limite de débit tout seul).
    let oldDeleted = 0;
    for (const m of old.values()) {
      if (await m.delete().then(() => true).catch(() => false)) { count++; oldDeleted++; }
    }

    if (count === 0) {
      await interaction.editReply({
        embeds: [errorEmbed('Impossible', 'Aucun message supprimé (épinglés ignorés ou permissions manquantes).')],
      });
      return;
    }
    const extra = oldDeleted > 0 ? ` (dont ${oldDeleted} de plus de 14 jours)` : '';
    await interaction.editReply({
      embeds: [successEmbed('Nettoyé', `${count} message(s) supprimé(s)${extra}.`)],
    });
  },
};
