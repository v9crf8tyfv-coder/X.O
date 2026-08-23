import { ChannelType, PermissionFlagsBits, type Client, type VoiceState } from 'discord.js';
import { db, hasDatabase } from '@xo/db';

const CREATOR_KEY = 'voice_creator';
const TEMP_PREFIX = '🔊 ';

async function creatorChannelId(): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    const rows = await db()<{ value: string }[]>`select value from bot_state where key = ${CREATOR_KEY}`;
    return rows.length ? rows[0]!.value : null;
  } catch {
    return null;
  }
}

/**
 * Join-to-create : rejoindre le salon "➕ Créer son Salon" crée un salon vocal perso,
 * qui est supprimé automatiquement dès qu'il est vide.
 */
export async function onVoiceStateUpdate(
  _client: Client,
  oldState: VoiceState,
  newState: VoiceState,
): Promise<void> {
  const creatorId = await creatorChannelId();

  // 1) Rejoint le salon "créer" -> on lui fait son propre salon
  if (creatorId && newState.channelId === creatorId && newState.member && newState.channel) {
    const guild = newState.guild;
    const temp = await guild.channels
      .create({
        name: `${TEMP_PREFIX}${newState.member.displayName}`,
        type: ChannelType.GuildVoice,
        parent: newState.channel.parentId ?? undefined,
        permissionOverwrites: [
          {
            id: newState.member.id,
            allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers],
          },
        ],
      })
      .catch(() => null);
    if (temp) await newState.member.voice.setChannel(temp).catch(() => {});
  }

  // 2) Quitte un salon temp devenu vide -> on le supprime
  const left = oldState.channel;
  if (
    left &&
    left.id !== creatorId &&
    left.name.startsWith(TEMP_PREFIX) &&
    left.members.size === 0
  ) {
    await left.delete().catch(() => {});
  }
}
