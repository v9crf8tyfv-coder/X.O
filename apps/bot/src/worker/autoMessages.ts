import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { BRAND_COLOR } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';

interface AutoMsg {
  id: number;
  channel_id: string;
  content: string;
  image_url: string | null;
  mode: string;
  every_hours: number | null;
  at_hhmm: string | null;
  last_sent_at: Date | null;
}

const TZ = 'Europe/Paris';

/** "HH:MM" actuel à Paris. */
function nowHHMM(): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date());
}
/** "YYYY-MM-DD" à Paris pour une date donnée. */
function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(d);
}

function isDue(m: AutoMsg): boolean {
  const now = new Date();
  if (m.mode === 'daily') {
    if (!m.at_hhmm) return false;
    if (nowHHMM() !== m.at_hhmm) return false;
    // Une seule fois par jour.
    return !m.last_sent_at || dayKey(m.last_sent_at) !== dayKey(now);
  }
  // interval
  const hours = m.every_hours && m.every_hours > 0 ? m.every_hours : 2;
  if (!m.last_sent_at) return true;
  return now.getTime() - new Date(m.last_sent_at).getTime() >= hours * 3_600_000;
}

async function tick(client: Client): Promise<void> {
  if (!hasDatabase()) return;
  const sql = db();
  const rows = await sql<AutoMsg[]>`
    select id, channel_id, content, image_url, mode, every_hours, at_hhmm, last_sent_at
    from auto_messages where enabled = true`;

  for (const m of rows) {
    if (!isDue(m)) continue;
    try {
      const ch = await client.channels.fetch(m.channel_id).catch(() => null);
      if (!ch || !ch.isTextBased()) continue;
      const text = ch as TextChannel;
      if (m.image_url) {
        const embed = new EmbedBuilder().setColor(BRAND_COLOR).setImage(m.image_url);
        if (m.content) embed.setDescription(m.content);
        await text.send({ embeds: [embed] });
      } else if (m.content) {
        await text.send({ content: m.content });
      } else {
        continue; // rien à envoyer
      }
      await sql`update auto_messages set last_sent_at = now() where id = ${m.id}`;
    } catch {
      /* salon injoignable / message invalide : on réessaiera au prochain tick */
    }
  }
}

/** Messages automatiques configurés dans le panel. Vérifie toutes les 60s (négligeable). */
export function startAutoMessages(client: Client): void {
  setTimeout(() => void tick(client).catch(() => {}), 20_000);
  setInterval(() => void tick(client).catch(() => {}), 60_000);
}
