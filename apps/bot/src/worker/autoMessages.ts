import { EmbedBuilder, type Client, type TextChannel, type Guild, type MessageCreateOptions } from 'discord.js';
import { BRAND_COLOR } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';

/**
 * Tags par ID : transforme "@<id>" en vraie mention Discord.
 * Si l'id correspond à un rôle du serveur → mention de rôle <@&id>, sinon membre <@id>.
 * (On ignore les mentions déjà formatées comme <@id> / <@&id> grâce au lookbehind.)
 */
function resolveMentions(content: string, guild: Guild | null): string {
  if (!guild) return content;
  return content.replace(/(?<!<)@(\d{17,20})/g, (_full, id: string) =>
    guild.roles.cache.has(id) ? `<@&${id}>` : `<@${id}>`,
  );
}

interface AutoMsg {
  id: number;
  channel_id: string;
  content: string;
  image_url: string | null;
  mode: string;
  every_hours: number | null;
  at_hhmm: string | null;
  days: string | null;
  last_sent_at: Date | null;
}

/** Jour de la semaine à Paris : 1=Lundi … 7=Dimanche. */
function nowDay(): number {
  const d = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(new Date());
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return map[d] ?? 1;
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
/** "YYYY-MM-DD HH" à Paris (pour n'envoyer qu'une fois par heure). */
function hourKey(d: Date): string {
  return dayKey(d) + ' ' + new Intl.DateTimeFormat('fr-FR', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d);
}

function isDue(m: AutoMsg): boolean {
  const now = new Date();
  if (m.mode === 'daily') {
    if (!m.at_hhmm) return false;
    if (m.days && !m.days.split(',').includes(String(nowDay()))) return false; // jours restreints
    if (nowHHMM() !== m.at_hhmm) return false;
    // Une seule fois par jour.
    return !m.last_sent_at || dayKey(m.last_sent_at) !== dayKey(now);
  }
  // interval aligné sur l'heure pile (0h, Nh, 2Nh…), une fois par heure.
  const hours = m.every_hours && m.every_hours > 0 ? m.every_hours : 2;
  const hh = nowHHMM();
  const hour = Number(hh.slice(0, 2));
  if (Number(hh.slice(3)) !== 0 || hour % hours !== 0) return false;
  return !m.last_sent_at || hourKey(new Date(m.last_sent_at)) !== hourKey(now);
}

async function tick(client: Client): Promise<void> {
  if (!hasDatabase()) return;
  const sql = db();
  const rows = await sql<AutoMsg[]>`
    select id, channel_id, content, image_url, mode, every_hours, at_hhmm, days, last_sent_at
    from auto_messages where enabled = true and channel_id is not null and channel_id <> ''`;

  for (const m of rows) {
    if (!isDue(m)) continue;
    try {
      const ch = await client.channels.fetch(m.channel_id).catch(() => null);
      if (!ch || !ch.isTextBased()) continue;
      const text = ch as TextChannel;
      // Le texte va dans le CORPS du message (pas dans un embed) pour que les mentions PING.
      const body = m.content ? resolveMentions(m.content, text.guild) : '';
      const payload: MessageCreateOptions = { allowedMentions: { parse: ['users', 'roles', 'everyone'] } };
      if (body) payload.content = body;
      if (m.image_url) payload.embeds = [new EmbedBuilder().setColor(BRAND_COLOR).setImage(m.image_url)];
      if (!payload.content && !payload.embeds) continue; // rien à envoyer
      await text.send(payload);
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
