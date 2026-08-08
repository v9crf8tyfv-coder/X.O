import { EmbedBuilder, type Client, type TextChannel } from 'discord.js';
import { CHANNELS, BRAND_COLOR } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { buildEffectif, type EffectifRow } from './effectif.js';

/**
 * Publie l'effectif dans le salon accueil. Édite le message existant s'il y en
 * a un (mémorisé dans bot_state), sinon en poste un nouveau et le mémorise.
 */
export async function publishEffectif(client: Client): Promise<void> {
  if (!hasDatabase()) return;

  const rows = await db()<EffectifRow[]>`
    select pseudo, grades, is_absent from staff where active = true
  `;
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('📋 Effectif du staff')
    .setDescription(buildEffectif(rows))
    .setTimestamp();

  const channel = await client.channels.fetch(CHANNELS.accueil).catch(() => null);
  if (!channel?.isTextBased()) return;
  const text = channel as TextChannel;

  const stored = await db()<{ value: string }[]>`
    select value from bot_state where key = 'effectif_message_id'
  `;
  const id = stored[0]?.value;
  if (id) {
    const msg = await text.messages.fetch(id).catch(() => null);
    if (msg) {
      await msg.edit({ embeds: [embed] });
      return;
    }
  }
  const msg = await text.send({ embeds: [embed] });
  await db()`
    insert into bot_state (key, value) values ('effectif_message_id', ${msg.id})
    on conflict (key) do update set value = ${msg.id}, updated_at = now()
  `;
}
