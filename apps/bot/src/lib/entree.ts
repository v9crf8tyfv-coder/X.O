import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  MessageFlags,
  type MessageCreateOptions,
} from 'discord.js';
import { ENTRY_SOURCES } from '@xo/shared';

export const ENTRY_SELECT_ID = 'entry:source';

/**
 * Panneau d'entrée (Components V2) : présentation FR + séparateur + présentation EN, puis le
 * menu déroulant "Comment as-tu connu EmeriaMC ?" — le tout DANS le cadre (comme l'effectif).
 */
export function buildEntreeMessage() {
  const title = '# 👋 Bienvenue sur EmeriaMC';

  const fr =
    '🇫🇷 **Français**\n\n' +
    'Un monde **Nations** 🏰 pour bâtir ton empire, un **Vanilla** 🌍 authentique, des ' +
    '**mini-jeux** 🎮 et des **events** 🎉 chaque semaine.\n\n' +
    'Avant de continuer, indique-nous **comment tu as découvert le serveur** via le menu ci-dessous. 👇\n' +
    'Une seule réponse suffit pour débloquer l’accès.';

  const en =
    '🇬🇧 **English**\n\n' +
    'A **Nations** 🏰 world to build your empire, an authentic **Vanilla** 🌍, ' +
    '**minigames** 🎮 and weekly **events** 🎉.\n\n' +
    'Before continuing, tell us **how you discovered the server** using the menu below. 👇\n' +
    'One answer is enough to unlock full access.';

  const menu = new StringSelectMenuBuilder()
    .setCustomId(ENTRY_SELECT_ID)
    .setPlaceholder('Comment as-tu connu EmeriaMC ? / How did you find us?')
    .addOptions(
      ENTRY_SOURCES.map((s) =>
        new StringSelectMenuOptionBuilder().setLabel(s.label).setValue(s.value).setEmoji(s.emoji),
      ),
    );
  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);

  const container = new ContainerBuilder()
    .setAccentColor(0x7c5cff)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(title))
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(fr))
    .addSeparatorComponents(new SeparatorBuilder()) // la barre entre FR et EN
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(en))
    .addSeparatorComponents(new SeparatorBuilder())
    .addActionRowComponents(row);

  return { components: [container], flags: MessageFlags.IsComponentsV2 } satisfies MessageCreateOptions;
}
