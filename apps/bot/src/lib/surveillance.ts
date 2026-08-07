import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { CHANNELS, type SurveillanceCategory } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';

/** Salon de surveillance selon la catégorie */
const CATEGORY_CHANNEL: Record<Exclude<SurveillanceCategory, 'none'>, string> = {
  respo: CHANNELS.surveillanceRespo, // les fonda surveillent les respo
  admin: CHANNELS.surveillanceAdmin, // les respo surveillent les admins
  staff: CHANNELS.surveillanceStaff, // les admins surveillent les staffs
};

const CATEGORY_COLOR: Record<Exclude<SurveillanceCategory, 'none'>, number> = {
  respo: 0x811010,
  admin: 0xdc1a1a,
  staff: 0x3ba55d,
};

export interface SurveillanceEntry {
  category: Exclude<SurveillanceCategory, 'none'>;
  action: string; // ex "Ajout de rôle", "Sanction"
  actor?: string | null; // qui a fait l'action
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

  // 1) Embed dans le salon
  const embed = new EmbedBuilder()
    .setColor(CATEGORY_COLOR[entry.category])
    .setTitle(`🛡️ Surveillance — ${entry.action}`)
    .setTimestamp();

  const desc: string[] = [];
  if (entry.actor) desc.push(`**Auteur :** ${entry.actor}`);
  if (entry.target) desc.push(`**Cible :** ${entry.target}`);
  desc.push(`**Source :** ${source}`);
  embed.setDescription(desc.join('\n'));

  if (entry.fields?.length) {
    embed.addFields(entry.fields.map((f) => ({ ...f, inline: false })));
  }

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

  // 2) Persistance en base (si Supabase configuré)
  if (hasDatabase()) {
    try {
      await db()`
        insert into surveillance_logs (category, action, actor, target, source, details, message_id)
        values (${entry.category}, ${entry.action}, ${entry.actor ?? null},
                ${entry.target ?? null}, ${source},
                ${entry.details ? JSON.stringify(entry.details) : null}::jsonb,
                ${messageId ?? null})
      `;
    } catch (err) {
      console.error('[surveillance] insertion DB échouée:', err);
    }
  }
}
