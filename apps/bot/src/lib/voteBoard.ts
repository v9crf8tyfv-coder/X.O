import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { BRAND_COLOR } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { getVoteRanking, type VoteRow } from './voteRanking.js';

const CH_KEY = 'vote_board_channel';
const MSG_KEY = 'vote_board_message';

function buildEmbed(top: VoteRow[]): EmbedBuilder {
  const e = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('Classement des votes — mois en cours')
    .setTimestamp()
    .setFooter({ text: 'Vote : emeria-site.com/wiki.html#vote · mis à jour automatiquement' });

  const top3 = top.slice(0, 3);
  if (top3.length === 0) {
    e.setDescription('Aucun vote ce mois-ci pour l’instant. Vote pour EmeriaMC et lance le classement !');
    return e;
  }
  const rank = ['1.', '2.', '3.'];
  e.setDescription(
    top3
      .map((p, i) => `**${rank[i]}** ${p.name} — **${p.votes}** vote${p.votes > 1 ? 's' : ''}`)
      .join('\n'),
  );
  e.setThumbnail(`https://mc-heads.net/avatar/${encodeURIComponent(top3[0]!.name)}/128`);
  return e;
}

async function getState(key: string): Promise<string | null> {
  if (!hasDatabase()) return null;
  const r = await db()<{ value: string }[]>`select value from bot_state where key = ${key}`;
  return r[0]?.value ?? null;
}
async function setState(key: string, value: string): Promise<void> {
  if (!hasDatabase()) return;
  await db()`
    insert into bot_state (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value`;
}

/**
 * (Re)publie ou met à jour l'embed du classement dans le salon configuré.
 * `forceChannelId` : appelé par /setup-vote pour (re)fixer le salon courant.
 */
export async function publishVoteBoard(client: Client, forceChannelId?: string): Promise<void> {
  const channelId = forceChannelId ?? (await getState(CH_KEY));
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;
  const text = channel as TextChannel;

  const embed = buildEmbed(await getVoteRanking(3));

  const msgId = await getState(MSG_KEY);
  if (msgId) {
    const msg = await text.messages.fetch(msgId).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed] });
      if (forceChannelId) await setState(CH_KEY, channelId);
      return;
    }
  }
  const sent = await text.send({ embeds: [embed] });
  await setState(CH_KEY, channelId);
  await setState(MSG_KEY, sent.id);
}
