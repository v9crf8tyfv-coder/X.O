import {
  ActionRowBuilder,
  ButtonBuilder,
  MessageFlags,
  type ButtonInteraction,
  type GuildMember,
  type TextChannel,
} from 'discord.js';
import { GRADES } from '@xo/shared';
import type { ComponentHandler } from '../types.js';
import { highestGrade } from '../lib/permissions.js';
import { errorEmbed, successEmbed } from '../lib/embeds.js';
import { startSession, stopSession, isRunning, toggleButton } from '../lib/train.js';

/** Modo (et au-dessus) uniquement */
function canTrain(member: GuildMember | null): boolean {
  if (!member) return false;
  return (highestGrade(member)?.level ?? 0) >= GRADES.modo.level;
}

/** Met à jour le bouton du panneau pour refléter l'état ON/OFF */
async function refreshPanel(interaction: ButtonInteraction, running: boolean): Promise<void> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(toggleButton(running));
  await interaction.message.edit({ components: [row] }).catch(() => {});
}

export const trainToggle: ComponentHandler<ButtonInteraction> = {
  prefix: 'train:toggle',
  async execute(interaction) {
    const member = interaction.member as GuildMember | null;
    if (!canTrain(member)) {
      await interaction.reply({
        embeds: [errorEmbed('Accès refusé', 'Réservé aux modérateurs et grades supérieurs.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const channel = interaction.channel as TextChannel | null;
    if (!channel?.isTextBased()) return;

    if (isRunning(channel.id)) {
      // ON -> OFF
      const handled = await stopSession(channel, interaction.user.tag);
      await refreshPanel(interaction, false);
      await interaction.reply({
        embeds: [successEmbed('Entraînement arrêté', `Cas correctement modérés : **${handled ?? 0}**.`)],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      // OFF -> ON
      await startSession(channel, interaction.user.tag);
      await refreshPanel(interaction, true);
      await interaction.reply({
        embeds: [successEmbed('Entraînement lancé', 'Réagis aux messages avec `mute pseudo temps raison`.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
