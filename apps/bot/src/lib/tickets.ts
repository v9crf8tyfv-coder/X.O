import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  type OverwriteResolvable,
  type Guild,
} from 'discord.js';
import {
  TICKET_CATEGORIES_STAFF,
  TICKET_CATEGORIES_NORMAL,
  TICKET_OMNIPRESENT_GRADES,
  BRAND_COLOR,
  getGrade,
  type TicketCategory,
} from '@xo/shared';

export type TicketSpace = 'staff' | 'normal';

export function categoriesFor(space: TicketSpace): readonly TicketCategory[] {
  return space === 'staff' ? TICKET_CATEGORIES_STAFF : TICKET_CATEGORIES_NORMAL;
}

export function findCategory(space: TicketSpace, id: string): TicketCategory | undefined {
  return categoriesFor(space).find((c) => c.id === id);
}

/** Menu déroulant des catégories de tickets */
export function buildCategorySelect(space: TicketSpace): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`ticket:open:${space}`)
    .setPlaceholder('Choisis une catégorie…')
    .addOptions(
      categoriesFor(space).map((c) => ({
        label: c.label,
        description: c.description.slice(0, 100),
        value: c.id,
        emoji: c.emoji,
      })),
    );
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

/** Embed du panneau de tickets (posté par /setup-ticket) */
export function buildTicketPanelEmbed(space: TicketSpace): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(space === 'staff' ? '🎫 Tickets Staff' : '🎫 Ouvrir un ticket')
    .setDescription(
      'Sélectionne une **catégorie** dans le menu ci-dessous pour ouvrir un ticket.\n' +
        'Un salon privé sera créé rien que pour toi.',
    )
    .setFooter({ text: 'X.O • Tickets' });
}

/** Embed persistant en haut du ticket (pseudo + type + bouton fermer) */
export function buildTicketHeaderEmbed(openerTag: string, category: TicketCategory): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`🎫 Ticket — ${category.label}`)
    .setDescription(
      `👤 **Ouvert par :** ${openerTag}\n` +
        `📌 **Type :** ${category.label}\n\n` +
        'Un membre du staff va te répondre. Utilise le bouton ci-dessous pour fermer.',
    );
}

export function buildCloseButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:close')
      .setLabel('Fermer le ticket')
      .setEmoji('🔒')
      .setStyle(ButtonStyle.Danger),
  );
}

/** Boutons de traitement d'un recrutement (admins/fonda uniquement). */
export function buildRecruitButtons(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('ticket:recruit:accept')
      .setLabel('Recrutement Accepter')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('ticket:recruit:refuse')
      .setLabel('Recrutement Refuser')
      .setEmoji('⛔')
      .setStyle(ButtonStyle.Danger),
  );
}

/**
 * Calcule les permissions du salon de ticket :
 * - @everyone : pas d'accès
 * - l'auteur : accès
 * - grades autorisés (catégorie) + omniprésents (fonda, co-fonda, resp) : accès
 */
export function buildTicketOverwrites(
  guild: Guild,
  openerId: string,
  category: TicketCategory,
): OverwriteResolvable[] {
  const allow =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.ReadMessageHistory;

  const overwrites: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: PermissionFlagsBits.ViewChannel },
    // Le bot garde toujours l'accès (lecture pour la transcription, suppression…)
    { id: guild.client.user.id, allow: allow | PermissionFlagsBits.ManageChannels },
    { id: openerId, allow },
  ];

  const gradeKeys = new Set<string>([
    ...TICKET_OMNIPRESENT_GRADES,
    ...(('onlyOmnipresent' in category && category.onlyOmnipresent)
      ? []
      : category.allowedGrades),
  ]);

  for (const key of gradeKeys) {
    const roleId = getGrade(key).roleId;
    if (roleId && guild.roles.cache.has(roleId)) {
      overwrites.push({ id: roleId, allow });
    }
  }

  return overwrites;
}
