import { type Message, type GuildMember } from 'discord.js';
import { GRADES } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { highestGrade, isFounderTierMember } from './permissions.js';

/** Salon staff « CM-IG » : tout message y est exécuté comme une commande console en jeu. */
const CM_IG_CHANNEL = '1562388360306360442';

let tableReady = false;
async function ensureTable(): Promise<void> {
  if (tableReady) return;
  await db()`
    create table if not exists ig_console (
      id bigserial primary key,
      cmd text not null,
      actor text,
      do_log boolean not null default false,
      processed boolean not null default false,
      created_at timestamptz not null default now()
    )
  `;
  tableReady = true;
}

/**
 * Console Discord → jeu. Dans le salon CM-IG, un message = une commande exécutée en jeu.
 *  - Exécution réservée aux admins et au-dessus (hiérarchie des cartes staff).
 *  - Loggée dans EmeriaLogs (par le mod) comme « <pseudo discord> : la commande »,
 *    SAUF pour les fondateurs / co-fondateurs (aucun log).
 * Retourne true si le message a été consommé (à ne pas traiter ailleurs).
 */
export async function handleConsoleMessage(message: Message): Promise<boolean> {
  if (message.channelId !== CM_IG_CHANNEL) return false;
  if (message.author.bot) return false;
  const cmd = message.content.trim();
  if (!cmd) return false;

  const member = message.member as GuildMember | null;
  const level = member ? highestGrade(member)?.level ?? 0 : 0;
  // Exécution réservée aux admins et + (lancer des commandes serveur est sensible).
  if (level < GRADES.admin.level) {
    await message.react('⛔').catch(() => {});
    return true;
  }
  if (!hasDatabase()) {
    await message.react('⚠️').catch(() => {});
    return true;
  }

  // Loggé à partir d'admin, SAUF fondateurs / co-fondateurs.
  const doLog = member ? !isFounderTierMember(member) : true;
  const actor = message.author.username;

  try {
    await ensureTable();
    await db()`insert into ig_console (cmd, actor, do_log) values (${cmd}, ${actor}, ${doLog})`;
    await message.react('✅').catch(() => {});
  } catch {
    await message.react('⚠️').catch(() => {});
  }
  return true;
}
