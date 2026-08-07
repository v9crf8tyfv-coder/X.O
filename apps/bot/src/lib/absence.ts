import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { formatFrDate, daysRemaining } from './dates.js';

export interface AbsenceRecord {
  id: string;
  discord_id: string;
  discord_tag: string | null;
  reason: string | null;
  start_date: string | null; // "YYYY-MM-DD"
  end_date: string | null;
  status: 'active' | 'finished';
  message_id: string | null;
  archive_message_id: string | null;
}

const COLOR_ACTIVE = 0x2ecc71; // vert — barre "En cours"
const COLOR_FINISHED = 0xe67e22; // orange/rouge — barre "Terminé/Archivée"

/** Construit l'embed "Nouvelle absence" au format de référence */
export function buildAbsenceEmbed(a: AbsenceRecord, archived = false): EmbedBuilder {
  const finished = a.status === 'finished' || archived;
  const jours = finished ? 0 : daysRemaining(a.end_date);
  const pseudo = a.discord_tag ?? `<@${a.discord_id}>`;

  const lines = [
    `👤 **Pseudo :** ${pseudo} (${jours}j)`,
    `📅 **Début :** ${formatFrDate(a.start_date)}`,
    `📅 **Fin :** ${formatFrDate(a.end_date)}`,
    `📊 **Statut :** ${finished ? '❌ Terminé' : '⏳ En cours...'}`,
    `📝 **Raison :** ${a.reason ?? '—'}`,
  ];
  if (archived) lines.push('📦 **Archivée**');

  return new EmbedBuilder()
    .setColor(finished ? COLOR_FINISHED : COLOR_ACTIVE)
    .setTitle('📅 Nouvelle absence')
    .setDescription(lines.join('\n'))
    .setTimestamp();
}

/** Boutons d'une absence active (Archiver / Supprimer / Modifier) */
export function buildAbsenceButtons(id: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`absence:archive:${id}`)
      .setLabel('Archiver')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`absence:delete:${id}`)
      .setLabel('Supprimer')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`absence:edit:${id}`)
      .setLabel('Modifier')
      .setStyle(ButtonStyle.Primary),
  );
}
