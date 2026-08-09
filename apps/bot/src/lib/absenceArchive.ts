import { type Client, type TextChannel } from 'discord.js';
import { CHANNELS } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { buildAbsenceEmbed, type AbsenceRecord } from './absence.js';
import { publishEffectif } from './effectifPublish.js';

/** Archive une absence : poste dans les archives, met à jour la base, supprime l'original */
export async function archiveAbsence(client: Client, absence: AbsenceRecord): Promise<void> {
  absence.status = 'finished';

  let archiveMsgId: string | null = null;
  const archiveCh = await client.channels.fetch(CHANNELS.archivesAbsence).catch(() => null);
  if (archiveCh?.isTextBased()) {
    const m = await (archiveCh as TextChannel).send({
      embeds: [buildAbsenceEmbed(absence, true)],
    });
    archiveMsgId = m.id;
  }

  await db()`
    update absences set status='finished', finished_at=now(), archive_message_id=${archiveMsgId}
    where id=${absence.id}
  `;
  await db()`update staff set is_absent=false where lower(pseudo)=lower(${absence.discord_tag})`;

  // supprime le message original dans le salon absences
  if (absence.message_id) {
    const ch = await client.channels.fetch(CHANNELS.absences).catch(() => null);
    if (ch?.isTextBased()) {
      const msg = await (ch as TextChannel).messages.fetch(absence.message_id).catch(() => null);
      await msg?.delete().catch(() => {});
    }
  }
  await publishEffectif(client).catch(() => {});
}

/** Archive AUTOMATIQUEMENT toutes les absences actives dont la date de fin est passée */
export async function autoArchiveExpired(client: Client): Promise<void> {
  if (!hasDatabase()) return;
  const rows = await db()<AbsenceRecord[]>`
    select id, discord_id, discord_tag, reason,
           to_char(start_date,'YYYY-MM-DD') as start_date,
           to_char(end_date,'YYYY-MM-DD') as end_date,
           status, message_id, archive_message_id
    from absences
    where status='active' and end_date < (now() at time zone 'Europe/Paris')::date
  `;
  for (const a of rows) {
    await archiveAbsence(client, a).catch((e) => console.error('[auto-archive]', e));
  }
}
