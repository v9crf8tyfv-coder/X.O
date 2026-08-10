import {
  type Interaction,
  MessageFlags,
  type GuildMember,
  type InteractionReplyOptions,
} from 'discord.js';
import { GRADES } from '@xo/shared';
import type { XOClient } from '../types.js';
import { highestGrade } from '../lib/permissions.js';
import { errorEmbed } from '../lib/embeds.js';

export async function handleInteraction(
  client: XOClient,
  interaction: Interaction,
): Promise<void> {
  try {
    // ---- Commandes slash ----
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Contrôle d'accès par NIVEAU de grade (défaut : fondateur)
      const min = command.minLevel ?? GRADES.fondateur.level;
      const member = interaction.member as GuildMember | null;
      const level = member ? highestGrade(member)?.level ?? 0 : 0;
      if (level < min) {
        await interaction.reply({
          embeds: [errorEmbed('Accès refusé', 'Ton grade ne permet pas cette commande.')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      await command.execute(interaction);
      return;
    }

    // ---- Boutons ----
    if (interaction.isButton()) {
      const handler = client.buttons.find((h) =>
        interaction.customId.startsWith(h.prefix),
      );
      if (handler) await handler.execute(interaction);
      return;
    }

    // ---- Menus déroulants (options) ----
    if (interaction.isStringSelectMenu()) {
      const handler = client.selectMenus.find((h) =>
        interaction.customId.startsWith(h.prefix),
      );
      if (handler) await handler.execute(interaction);
      return;
    }

    // ---- Menus de sélection de rôle ----
    if (interaction.isRoleSelectMenu()) {
      const handler = client.roleSelects.find((h) =>
        interaction.customId.startsWith(h.prefix),
      );
      if (handler) await handler.execute(interaction);
      return;
    }

    // ---- Modals ----
    if (interaction.isModalSubmit()) {
      const handler = client.modals.find((h) =>
        interaction.customId.startsWith(h.prefix),
      );
      if (handler) await handler.execute(interaction);
      return;
    }
  } catch (err) {
    console.error('[interaction] erreur:', err);
    if (interaction.isRepliable()) {
      const payload: InteractionReplyOptions = {
        embeds: [errorEmbed('Erreur', 'Une erreur est survenue.')],
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  }
}
