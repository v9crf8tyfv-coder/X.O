import { db } from '@xo/db';
import type { TextChannel, MessageCreateOptions, MessageEditOptions } from 'discord.js';

/**
 * Poste OU met à jour UN message persistant (comme l'effectif) : son ID est stocké dans
 * bot_state[key]. À chaque re-setup, on ÉDITE le message existant au lieu d'en reposter un
 * nouveau — les réactions/boutons et l'emplacement sont conservés, plus besoin de supprimer
 * l'ancien à la main. Gratuité OK : juste une ligne (key, messageId) dans la DB partagée.
 */
export async function publishOrUpdatePanel(
  channel: TextChannel,
  key: string,
  payload: MessageCreateOptions & MessageEditOptions,
): Promise<void> {
  let id: string | null = null;
  try {
    const rows = await db()<{ value: string }[]>`select value from bot_state where key = ${key}`;
    id = rows[0]?.value ?? null;
  } catch {
    /* DB indispo -> on poste simplement un message */
  }

  if (id) {
    const msg = await channel.messages.fetch(id).catch(() => null);
    if (msg) {
      // En édition avec des fichiers (image/bannière), on remplace les pièces jointes.
      const editPayload: MessageEditOptions = { ...(payload as MessageEditOptions) };
      if (payload.files && payload.files.length) editPayload.attachments = [];
      await msg.edit(editPayload);
      return;
    }
  }

  const posted = await channel.send(payload as MessageCreateOptions);
  try {
    await db()`insert into bot_state (key, value) values (${key}, ${posted.id})
      on conflict (key) do update set value = ${posted.id}, updated_at = now()`;
  } catch {
    /* pas bloquant : au pire on reposte au prochain setup */
  }
}
