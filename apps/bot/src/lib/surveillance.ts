import { EmbedBuilder, type ChatInputCommandInteraction, type Client, type TextChannel } from 'discord.js';
import { CHANNELS, getGrade, gradeColorInt, type SurveillanceCategory } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { memberSurveillanceCategory, memberTopGrade } from './surveillanceCategory.js';

/**
 * Journalise une action faite via une commande du BOT (ex: /ban, /mute) avec le VRAI auteur
 * (l'audit log Discord montrerait le bot). Rien n'est logué pour les fonda/non-staff.
 */
export async function surveilCommand(
  interaction: ChatInputCommandInteraction,
  action: string,
  target?: string | null,
  fields?: { name: string; value: string }[],
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;
  const member = await guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return;
  const top = memberTopGrade(member);
  if (top.surveillance === 'none') return;
  await logSurveillance(interaction.client, {
    category: top.surveillance,
    action,
    actor: interaction.user.tag,
    actorGradeKey: top.key,
    actorAvatar: member.displayAvatarURL({ size: 64 }),
    target: target ?? null,
    source: 'discord',
    fields,
  });
}

/** Salon de surveillance selon la catégorie */
const CATEGORY_CHANNEL: Record<Exclude<SurveillanceCategory, 'none'>, string> = {
  respo: CHANNELS.surveillanceRespo, // les fonda surveillent les respo
  admin: CHANNELS.surveillanceAdmin, // les respo surveillent les admins
  staff: CHANNELS.surveillanceStaff, // les admins surveillent les staffs
};

/** Couleur de repli si on n'a pas le grade exact de l'auteur. */
const CATEGORY_COLOR: Record<Exclude<SurveillanceCategory, 'none'>, number> = {
  respo: 0x811010,
  admin: 0xdc1a1a,
  staff: 0x3ba55d,
};

const CATEGORY_LABEL: Record<Exclude<SurveillanceCategory, 'none'>, string> = {
  respo: 'Responsables',
  admin: 'Admins',
  staff: 'Staff',
};

/** Icône selon le type d'action (recherche par mot-clé dans le libellé). */
function iconFor(action: string): string {
  const a = action.toLowerCase();
  const has = (...w: string[]) => w.some((x) => a.includes(x));
  if (has('unmute')) return '🔊';
  if (has('mute', 'timeout')) return '🔇';
  if (has('déban', 'deban', 'unban')) return '✅';
  if (has('ban')) return '🔨';
  if (has('kick', 'expuls')) return '👢';
  if (has('unjail')) return '🔓';
  if (has('jail', 'prison')) return '⛓️';
  if (has('freeze', 'gel')) return '❄️';
  if (has('rôle', 'role', 'grade')) return '🎭';
  if (has('épingl', 'epingl', 'pin')) return '📌';
  if (has('message')) return '🗑️';
  if (has('salon', 'channel')) return '📁';
  if (has('permission')) return '🔐';
  if (has('vocal', 'voice', 'déplacement', 'déconnexion')) return '🎙️';
  if (has('invit')) return '🔗';
  if (has('emoji')) return '😀';
  if (has('webhook')) return '🪝';
  if (has('gamemode', 'mode de jeu')) return '🎮';
  if (has('give', 'donne', 'item')) return '🎁';
  if (has('tp', 'téléport', 'teleport')) return '✨';
  if (has('fly', 'vol')) return '🕊️';
  if (has('vanish')) return '👻';
  if (has('kill', 'tue')) return '💀';
  if (has('/op', ' op', 'opérateur')) return '⚡';
  if (has('effect')) return '🧪';
  if (has('clear', 'vide')) return '🧹';
  if (has('commande')) return '⌨️';
  return '🛡️';
}

/** Métadonnées de la source (emoji + libellé). */
function sourceMeta(source: 'discord' | 'site' | 'ig'): { emoji: string; label: string } {
  if (source === 'ig') return { emoji: '🎮', label: 'En jeu' };
  if (source === 'site') return { emoji: '🌐', label: 'Site' };
  return { emoji: '💬', label: 'Discord' };
}

export interface SurveillanceEntry {
  category: Exclude<SurveillanceCategory, 'none'>;
  action: string; // ex "Ajout de rôle", "Sanction"
  actor?: string | null; // qui a fait l'action
  /** clé de grade de l'auteur → couleur de l'embed + libellé */
  actorGradeKey?: string | null;
  /** URL de l'avatar de l'auteur (Discord) ou tête MC */
  actorAvatar?: string | null;
  target?: string | null; // sur qui / quoi
  source?: 'discord' | 'site' | 'ig';
  details?: Record<string, unknown>;
  /** lignes supplémentaires affichées dans l'embed */
  fields?: { name: string; value: string }[];
}

/**
 * Journalise une action dans le bon salon de surveillance + en base.
 * ⚠️ N'appelle PAS ceci pour les actions faites PAR un fondateur
 *    (règle : les actions des fonda ne sont pas surveillées).
 */
export async function logSurveillance(
  client: Client,
  entry: SurveillanceEntry,
): Promise<void> {
  const source = entry.source ?? 'discord';
  const src = sourceMeta(source);
  const color = entry.actorGradeKey ? gradeColorInt(entry.actorGradeKey) : CATEGORY_COLOR[entry.category];
  const gradeLabel = entry.actorGradeKey ? getGrade(entry.actorGradeKey).label : null;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`${iconFor(entry.action)} ${entry.action}`)
    .setTimestamp()
    .setFooter({ text: `Surveillance ${CATEGORY_LABEL[entry.category]} · ${src.emoji} ${src.label} · EmeriaMC` });

  // Auteur en en-tête (avec son grade) + avatar.
  if (entry.actor) {
    embed.setAuthor({
      name: gradeLabel ? `${entry.actor} · ${gradeLabel}` : entry.actor,
      iconURL: entry.actorAvatar ?? undefined,
    });
  }

  // Champs propres et lisibles.
  const fields: { name: string; value: string; inline?: boolean }[] = [];
  if (entry.target) fields.push({ name: '🎯 Cible', value: entry.target, inline: true });
  fields.push({ name: '📡 Source', value: `${src.emoji} ${src.label}`, inline: true });
  if (entry.fields?.length) {
    for (const f of entry.fields) fields.push({ name: f.name, value: f.value, inline: false });
  }
  embed.addFields(fields);

  let messageId: string | undefined;
  try {
    const channelId = CATEGORY_CHANNEL[entry.category];
    const channel = await client.channels.fetch(channelId);
    if (channel?.isTextBased()) {
      const msg = await (channel as TextChannel).send({ embeds: [embed] });
      messageId = msg.id;
    }
  } catch (err) {
    console.error('[surveillance] envoi du log échoué:', err);
  }

  // Persistance en base (si Supabase configuré)
  if (hasDatabase()) {
    try {
      await db()`
        insert into surveillance_logs (category, action, actor, target, source, details, message_id)
        values (${entry.category ?? 'staff'}, ${entry.action ?? '?'}, ${entry.actor ?? null},
                ${entry.target ?? null}, ${source ?? 'discord'},
                ${entry.details ? JSON.stringify(entry.details) : null}::jsonb,
                ${messageId ?? null})
      `;
    } catch (err) {
      console.error('[surveillance] insertion DB échouée:', err);
    }
  }
}

// Réexport pratique pour les handlers d'événements.
export { memberSurveillanceCategory, memberTopGrade };
