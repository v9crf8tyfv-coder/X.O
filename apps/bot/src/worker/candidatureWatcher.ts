import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type Client,
  type TextChannel,
} from 'discord.js';
import { db, hasDatabase } from '@xo/db';
import { GRADES } from '@xo/shared';

/** Salon où sont postées les nouvelles candidatures du forum. */
const CANDID_CHANNEL_ID = '1544737983805136907';
/** Rôle mentionné à chaque nouvelle candidature. */
const ADMIN_ROLE_ID = GRADES.admin.roleId;
const SITE = 'https://emeria-site.com';

interface CandidatureEvent {
  id: string;
  thread_id: string | null;
  grade: string | null;
  player: string;
  player_uuid: string | null;
  title: string | null;
}

/** Couleur d'embed selon le grade visé (alignée sur les couleurs des cartes staff). */
function colorFor(grade: string): number {
  const g = grade.toLowerCase();
  if (g.startsWith('respons')) return 0x811010;
  if (g.startsWith('admin')) return 0xdc1a1a;
  if (g.startsWith('modér') || g.startsWith('moder')) return 0x9b59b6;
  if (g.startsWith('build')) return 0x3ba55d;
  if (g.startsWith('commu')) return 0xd98e2b;
  if (g.startsWith('bêta') || g.startsWith('beta')) return 0x7e8c9c;
  if (g.startsWith('guide')) return 0x22c55e;
  if (g.startsWith('dev')) return 0xe0a82b;
  return 0x7c5cff;
}

let running = false;

/**
 * Relaie les candidatures créées sur le forum vers Discord : un embed
 * « Nouvelle Candidature — <grade> » + mention Admin + bouton « Traité ».
 * (La table candidature_events est alimentée par le site, api/forum.js.)
 */
export function startCandidatureWatcher(client: Client): void {
  if (!hasDatabase()) return;
  // Crée la table si le site ne l'a pas encore fait (idempotent, zéro coût ensuite).
  db()`create table if not exists candidature_events (
    id bigserial primary key, thread_id bigint, category_id bigint, grade text,
    player text, player_uuid text, title text, status text not null default 'new',
    discord_message_id text, handled_by text, handled_at timestamptz,
    created_at timestamptz not null default now()
  )`.catch(() => {});
  // Récupère les lignes coincées en 'posting' (crash précédent) → repassées en 'new'.
  db()`update candidature_events set status='new' where status='posting'`.catch(() => {});
  console.log('[candidatures] relai forum → Discord démarré (15s)');
  const tick = () => poll(client).catch((e) => console.error('[candidatures]', e));
  setTimeout(tick, 10_000);
  setInterval(tick, 15_000);
}

async function poll(client: Client): Promise<void> {
  if (running) return;
  running = true;
  try {
    const pending = await db()<{ id: string }[]>`
      select id from candidature_events where status = 'new' order by created_at asc limit 5
    `;
    if (!pending.length) return;

    const channel = await client.channels.fetch(CANDID_CHANNEL_ID).catch(() => null);
    if (!channel?.isTextBased()) return;
    const text = channel as TextChannel;

    for (const p of pending) {
      // Réservation ATOMIQUE : une seule tick/instance peut passer 'new' -> 'posting'.
      // Empêche les doublons (2 process du bot, ou 2 ticks qui se chevauchent).
      const claimed = await db()<CandidatureEvent[]>`
        update candidature_events set status = 'posting'
        where id = ${p.id} and status = 'new'
        returning id, thread_id, grade, player, player_uuid, title
      `;
      if (!claimed.length) continue; // déjà pris ailleurs
      const ev = claimed[0]!;
      try {
        const grade = ev.grade || 'Staff';
        const player = ev.player || 'Joueur';
        const face = `https://mc-heads.net/avatar/${encodeURIComponent(player)}/128`;
        const link = ev.thread_id ? `${SITE}/forum#thread=${ev.thread_id}` : `${SITE}/forum`;
        const embed = new EmbedBuilder()
          .setColor(colorFor(grade))
          .setAuthor({ name: `Nouvelle Candidature — ${grade}`, iconURL: face })
          .setThumbnail(face)
          .setDescription(
            `**Joueur :** ${player}\n` +
              `**Grade visé :** ${grade}\n` +
              (ev.title ? `**Sujet :** ${ev.title}\n` : '') +
              `\n[Voir la candidature sur le forum](${link})`,
          )
          .setTimestamp(new Date());

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`candid_done:${ev.id}`)
            .setLabel('Traité')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅'),
          new ButtonBuilder()
            .setLabel('Ouvrir sur le forum')
            .setStyle(ButtonStyle.Link)
            .setURL(link),
        );

        const msg = await text.send({
          content: `<@&${ADMIN_ROLE_ID}>`,
          embeds: [embed],
          components: [row],
        });
        await db()`update candidature_events set status='posted', discord_message_id=${msg.id} where id=${ev.id}`;
      } catch (err) {
        const m = err instanceof Error ? err.message : String(err);
        console.error('[candidatures] envoi échoué', ev.id, m);
        // Marque en erreur pour ne pas boucler indéfiniment sur la même ligne.
        await db()`update candidature_events set status='error' where id=${ev.id}`.catch(() => {});
      }
    }
  } finally {
    running = false;
  }
}
