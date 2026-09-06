import type { Client, TextChannel } from 'discord.js';
import { db, hasDatabase } from '@xo/db';
import { CHANNELS } from '@xo/shared';
import { buildAbsenceEmbed, type AbsenceRecord } from '../lib/absence.js';
import { autoArchiveExpired, refreshAbsenceFlags } from '../lib/absenceArchive.js';
import { publishEffectif } from '../lib/effectifPublish.js';

const EVERY_MS = 30 * 60_000; // 30 min

/**
 * Réveille les absences au bon moment :
 *  - archive celles dont la date de fin est passée ;
 *  - recalcule `is_absent` (une absence "à venir" s'active toute seule le jour venu) ;
 *  - rafraîchit les embeds des absences actives (couleur "à venir" → "en cours") ;
 *  - republie l'effectif (le ⏰ suit is_absent).
 * Tout est en try/catch → ne peut pas casser le bot.
 */
async function tick(client: Client): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await autoArchiveExpired(client); // archive expirées + refreshAbsenceFlags interne
  } catch (e) {
    console.error('[absence] auto-archive', e instanceof Error ? e.message : e);
  }

  try {
    const rows = await db()<AbsenceRecord[]>`
      select id, discord_id, discord_tag, reason,
             to_char(start_date,'YYYY-MM-DD') as start_date,
             to_char(end_date,'YYYY-MM-DD') as end_date,
             status, message_id, archive_message_id
      from absences where status = 'active'
    `;
    const ch = await client.channels.fetch(CHANNELS.absences).catch(() => null);
    if (ch?.isTextBased()) {
      for (const a of rows) {
        if (!a.message_id) continue;
        const msg = await (ch as TextChannel).messages.fetch(a.message_id).catch(() => null);
        if (msg) await msg.edit({ embeds: [buildAbsenceEmbed(a)] }).catch(() => {});
      }
    }
    await refreshAbsenceFlags();
    await publishEffectif(client);
  } catch (e) {
    console.error('[absence] refresh', e instanceof Error ? e.message : e);
  }
}

export function startAbsenceWatcher(client: Client): void {
  if (!hasDatabase()) {
    console.log('[absence] pas de base → désactivé');
    return;
  }
  console.log('[absence] watcher démarré (30 min)');
  void tick(client);
  setInterval(() => void tick(client), EVERY_MS);
}
