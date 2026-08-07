import {
  type Interaction,
  MessageFlags,
  type GuildMember,
  type InteractionReplyOptions,
} from 'discord.js';
import type { XOClient } from '../types.js';
import { isFounder } from '../lib/permissions.js';
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

      // Toutes les commandes fonda sont réservées aux fondateurs
      if (command.founderOnly) {
        const member = interaction.member as GuildMember | null;
        if (!member || !isFounder(member)) {
          await interaction.reply({
            embeds: [errorEmbed('Accès refusé', 'Réservé aux **Fondateurs**.')],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
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
