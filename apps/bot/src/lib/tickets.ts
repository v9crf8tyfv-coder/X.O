import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  type OverwriteResolvable,
  type Guild,
  type CategoryChannel,
} from 'discord.js';
import {
  TICKET_CATEGORIES_STAFF,
  TICKET_CATEGORIES_NORMAL,
  TICKET_OMNIPRESENT_GRADES,
  STAFF_GUILD_ROLE_IDS,
  CHANNELS,
  BRAND_COLOR,
  getGrade,
  type TicketCategory,
} from '@xo/shared';

/** IDs de rôle d'un grade sur le serveur courant : principal + staff (on garde ceux qui existent). */
function roleIdsFor(guild: Guild, key: string): string[] {
  const ids = [getGrade(key).roleId, STAFF_GUILD_ROLE_IDS[key]].filter((r): r is string => !!r);
  return ids.filter((id) => guild.roles.cache.has(id));
}

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
      space === 'staff'
        ? 'Sélectionne une **catégorie** dans le menu ci-dessous pour ouvrir un ticket.\n' +
            'Un salon privé sera créé rien que pour toi.'
        : '📞 N’hésite pas à faire un ticket en cas de **problèmes**.\n' +
            '👉 Les problèmes de **Launcher** ou ceux qui nécessitent l’intervention d’un **Responsable** se trouvent sur le site.',
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

/** Un type de ticket est-il réservé aux responsables (et +) ? */
export function isRespoOnly(category: TicketCategory): boolean {
  return 'onlyOmnipresent' in category && !!category.onlyOmnipresent;
}

/**
 * Range le ticket dans la bonne CATÉGORIE Discord parente.
 *
 * - Tickets STAFF : on ne CRÉE aucune catégorie. Le ticket reste sous la même
 *   catégorie que le salon du panneau de tickets staff (s'il en a une).
 * - Tickets JOUEURS : "Besoin Responsable" (resp-only) ou "Divers" (créées si absentes).
 *
 * Renvoie l'ID de la catégorie parente à utiliser (ou undefined = aucune).
 */
export async function resolveTicketParent(
  guild: Guild,
  space: TicketSpace,
  category: TicketCategory,
): Promise<string | undefined> {
  if (space === 'staff') {
    const panel =
      guild.channels.cache.get(CHANNELS.ticketStaff) ??
      (await guild.channels.fetch(CHANNELS.ticketStaff).catch(() => null));
    return panel?.parentId ?? undefined;
  }

  // Normal : TOUS les tickets sous la catégorie "Support" (ID fixe, Discord communautaire).
  const cat =
    guild.channels.cache.get(SUPPORT_CATEGORY_ID) ??
    (await guild.channels.fetch(SUPPORT_CATEGORY_ID).catch(() => null));
  return cat?.id ?? undefined;
}

/** Catégorie Discord "Support" (communauté) où sont créés les tickets normaux. */
const SUPPORT_CATEGORY_ID = '1553885968686129153';

/** Permissions de la catégorie "Besoin Responsable" : personne, sauf Resp/Fonda/Co-fonda (+ bot). */
function respoCategoryOverwrites(guild: Guild): OverwriteResolvable[] {
  const allow =
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.ReadMessageHistory;
  const ows: OverwriteResolvable[] = [
    { id: guild.roles.everyone.id, deny: PermissionFlagsBits.ViewChannel },
    { id: guild.client.user.id, allow: allow | PermissionFlagsBits.ManageChannels },
  ];
  for (const key of TICKET_OMNIPRESENT_GRADES) {
    for (const roleId of roleIdsFor(guild, key)) ows.push({ id: roleId, allow });
  }
  return ows;
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

  // Tickets "Divers" (tout ce qui n'est pas Besoin Responsable) : les ADMINS voient
  // toujours, en plus des grades autorisés de la catégorie. Les tickets resp-only
  // (Besoin Responsable) restent réservés aux Resp/Fonda/Co-fonda.
  const gradeKeys = new Set<string>([
    ...TICKET_OMNIPRESENT_GRADES,
    ...(isRespoOnly(category) ? [] : [...category.allowedGrades, 'admin']),
  ]);

  for (const key of gradeKeys) {
    for (const roleId of roleIdsFor(guild, key)) {
      overwrites.push({ id: roleId, allow });
    }
  }

  return overwrites;
}
