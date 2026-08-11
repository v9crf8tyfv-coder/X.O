import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { SlashCommand } from '../../types.js';
import { GRADES } from '@xo/shared';
import { successEmbed, errorEmbed } from '../../lib/embeds.js';
import { setServerTimer, fmtDuration, RENEWAL_SEC } from '../../lib/serverTimer.js';

export const setbytenut: SlashCommand = {
  minLevel: GRADES.fondateur.level,
  data: new SlashCommandBuilder()
    .setName('setbytenut')
    .setDescription('Régler le temps restant du serveur (ping fonda à 0, bouton pour relancer)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addIntegerOption((o) =>
      o
        .setName('heures')
        .setDescription('Heures restantes affichées sur Bytenut')
        .setMinValue(0)
        .setMaxValue(48),
    )
    .addIntegerOption((o) =>
      o
        .setName('minutes')
        .setDescription('Minutes restantes affichées sur Bytenut')
        .setMinValue(0)
        .setMaxValue(59),
    ),

  async execute(interaction) {
    const hours = interaction.options.getInteger('heures') ?? 0;
    const mins = interaction.options.getInteger('minutes') ?? 0;
    const totalSec = (hours * 60 + mins) * 60;
    if (totalSec <= 0) {
      await interaction.reply({
        embeds: [errorEmbed('Durée invalide', 'Indique au moins des heures ou des minutes (> 0).')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const at = await setServerTimer(interaction.client, totalSec, RENEWAL_SEC);
    await interaction.reply({
      embeds: [
        successEmbed(
          'Timer Bytenut lancé',
          `Premier rappel dans **${fmtDuration(totalSec)}** (<t:${Math.floor(at / 1000)}:t>).\n` +
            `Ensuite, le bouton **« Je l’ai fais »** relance **${fmtDuration(RENEWAL_SEC)}** à chaque fois.`,
        ),
      ],
      flags: MessageFlags.Ephemeral,
    });
  },
};
