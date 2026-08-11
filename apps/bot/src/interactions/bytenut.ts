import { MessageFlags, type ButtonInteraction, type GuildMember } from 'discord.js';
import { GRADES } from '@xo/shared';
import type { ComponentHandler } from '../types.js';
import { successEmbed, errorEmbed } from '../lib/embeds.js';
import { highestGrade } from '../lib/permissions.js';
import { restartServerTimer, RENEW_BUTTON_ID, fmtDuration } from '../lib/serverTimer.js';

/** Bouton vert « Je l'ai fais » -> relance le compte à rebours (fondateurs uniquement). */
export const bytenutRenew: ComponentHandler<ButtonInteraction> = {
  prefix: RENEW_BUTTON_ID,
  async execute(interaction) {
    // Réservé aux fondateurs
    const member = interaction.member as GuildMember | null;
    const level = member ? highestGrade(member)?.level ?? 0 : 0;
    if (level < GRADES.fondateur.level) {
      await interaction.reply({
        embeds: [errorEmbed('Accès refusé', 'Seuls les fondateurs peuvent relancer le timer.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const at = await restartServerTimer(interaction.client);
    if (at == null) {
      await interaction.reply({
        embeds: [errorEmbed('Impossible', 'Aucune durée enregistrée. Refais `/setbytenut`.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const remainingSec = Math.round((at - Date.now()) / 1000);
    // Le message d'alerte devient un accusé de relance (bouton retiré)
    await interaction.update({
      embeds: [
        successEmbed(
          '✅ Serveur renouvelé',
          `Relancé par <@${interaction.user.id}>. Prochain rappel dans **${fmtDuration(remainingSec)}** ` +
            `(<t:${Math.floor(at / 1000)}:t>).`,
        ),
      ],
      components: [],
    });
  },
};
