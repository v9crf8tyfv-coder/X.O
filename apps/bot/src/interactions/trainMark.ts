import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags, type ButtonInteraction, type GuildMember } from 'discord.js';
import type { ComponentHandler } from '../types.js';
import { GRADES } from '@xo/shared';
import { highestGrade } from '../lib/permissions.js';
import { errorEmbed } from '../lib/embeds.js';

/** Bouton Correct / Incorrect sur une réponse d'entraînement (admins et +). */
export const trainMark: ComponentHandler<ButtonInteraction> = {
  prefix: 'trainmark',
  async execute(interaction) {
    const member = interaction.member as GuildMember | null;
    const level = member ? highestGrade(member)?.level ?? 0 : 0;
    if (level < GRADES.admin.level) {
      await interaction.reply({ embeds: [errorEmbed('Non autorisé', 'Réservé aux admins et +.')], flags: MessageFlags.Ephemeral });
      return;
    }
    const ok = interaction.customId.split(':')[1] === 'ok';
    const old = interaction.message.embeds[0];
    const embed = old ? EmbedBuilder.from(old) : new EmbedBuilder();
    embed.setColor(ok ? 0x3ba55d : 0xe0413e);
    embed.addFields({ name: ok ? 'Correct' : 'Incorrect', value: `Noté par ${interaction.user.toString()}`, inline: true });
    // Bouton figé (verdict posé), on garde une trace visuelle.
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('trainmark:done').setLabel(ok ? 'Correct' : 'Incorrect').setStyle(ok ? ButtonStyle.Success : ButtonStyle.Danger).setDisabled(true),
    );
    await interaction.update({ embeds: [embed], components: [row] });
  },
};
