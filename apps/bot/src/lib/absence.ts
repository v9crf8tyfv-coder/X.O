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

const COLOR_FUTURE = 0xe67e22; // orange — à venir
const COLOR_ACTIVE = 0x2ecc71; // vert — en cours
const COLOR_FINISHED = 0xe74c3c; // rouge — terminée

/** État d'une absence selon les dates (heure fr approx via UTC) */
export function absenceState(
  a: AbsenceRecord,
  archived = false,
): 'future' | 'active' | 'finished' {
  if (archived || a.status === 'finished') return 'finished';
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  if (a.start_date && a.start_date > today) return 'future';
  if (a.end_date && a.end_date < today) return 'finished';
  return 'active';
}

/** Construit l'embed "Nouvelle absence" (3 états : à venir / en cours / terminée) */
export function buildAbsenceEmbed(a: AbsenceRecord, archived = false): EmbedBuilder {
  const state = absenceState(a, archived);
  const jours = state === 'finished' ? 0 : daysRemaining(a.end_date);
  const pseudo = a.discord_tag ?? `<@${a.discord_id}>`;

  const statusText =
    state === 'future' ? '🕓 À venir' : state === 'active' ? '⏳ En cours...' : '❌ Terminé';
  const color =
    state === 'future' ? COLOR_FUTURE : state === 'active' ? COLOR_ACTIVE : COLOR_FINISHED;

  const lines = [
    `👤 **Pseudo :** ${pseudo} (${jours}j)`,
    `📅 **Début :** ${formatFrDate(a.start_date)}`,
    `📅 **Fin :** ${formatFrDate(a.end_date)}`,
    `📊 **Statut :** ${statusText}`,
    `📝 **Raison :** ${a.reason ?? '—'}`,
  ];
  if (archived) lines.push('📦 **Archivée**');

  return new EmbedBuilder()
    .setColor(color)
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
