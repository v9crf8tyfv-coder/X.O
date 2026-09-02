import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  type ButtonInteraction,
  type GuildMember,
} from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { GRADES } from '@xo/shared';
import { highestGrade } from '../lib/permissions.js';
import { db, hasDatabase } from '@xo/db';
import { errorEmbed } from '../lib/embeds.js';

/** Bouton « Traité » sur une candidature du forum (admins et + uniquement). */
export const candidatureDone: ComponentHandler<ButtonInteraction> = {
  prefix: 'candid_done',
  async execute(interaction) {
    const member = interaction.member as GuildMember | null;
    const level = member ? highestGrade(member)?.level ?? 0 : 0;
    if (level < GRADES.admin.level) {
      await interaction.reply({
        embeds: [errorEmbed('Non autorisé', 'Seuls les admins et + peuvent marquer une candidature comme traitée.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const eventId = interaction.customId.split(':')[1];
    let threadId: string | null = null;
    if (hasDatabase() && eventId) {
      const rows = await db()<{ thread_id: string | null }[]>`
        update candidature_events set status='traite', handled_by=${interaction.user.tag}, handled_at=now()
        where id=${eventId} returning thread_id
      `.catch(() => [] as { thread_id: string | null }[]);
      threadId = rows[0]?.thread_id ?? null;
    }

    // Désactive le bouton "Traité", garde le lien forum, et note qui a traité.
    const oldEmbed = interaction.message.embeds[0];
    const embed = oldEmbed ? EmbedBuilder.from(oldEmbed) : new EmbedBuilder();
    embed.setColor(0x3ba55d);
    embed.addFields({ name: 'Traité par', value: interaction.user.toString(), inline: true });

    const link = threadId
      ? `https://emeria-site.com/forum#thread=${threadId}`
      : 'https://emeria-site.com/forum';

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('candid_done_disabled')
        .setLabel(`Traité par ${interaction.user.username}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder().setLabel('Ouvrir sur le forum').setStyle(ButtonStyle.Link).setURL(link),
    );

    await interaction.update({ embeds: [embed], components: [row] });
  },
};
