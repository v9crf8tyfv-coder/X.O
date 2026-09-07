import { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder } from 'discord.js';
import { ENTRY_SOURCES } from '@xo/shared';

export const ENTRY_SELECT_ID = 'entry:source';

/** Panneau d'entrée : embed de présentation + menu déroulant "Comment as-tu connu EmeriaMC ?". */
export function buildEntreeMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x7c5cff)
    .setTitle('Bienvenue sur EmeriaMC')
    .setDescription(
      "**EmeriaMC** est un serveur Minecraft né de l'amitié entre deux passionnés : un monde " +
        "**Nations** pour bâtir ton empire, un **Vanilla** authentique pour survivre, des " +
        "**mini-jeux** pour te défier et des **events** chaque semaine — le tout sur des cartes " +
        "uniques créées par notre équipe.\n\n" +
        "**Avant d'accéder au reste du serveur, indique-nous comment tu as connu EmeriaMC** en " +
        "choisissant une réponse dans le menu ci-dessous.\n\n" +
        "**Une seule réponse suffit pour débloquer l'accès complet au serveur.**",
    );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(ENTRY_SELECT_ID)
    .setPlaceholder('Comment as-tu connu EmeriaMC ?')
    .addOptions(ENTRY_SOURCES.map((s) => ({ label: s.label, value: s.value })));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
  return { embeds: [embed], components: [row] };
}
