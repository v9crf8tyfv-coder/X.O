import type { Client } from 'discord.js';
import { queryFull } from 'minecraft-server-util';
import { db, hasDatabase } from '@xo/db';
import { publishEffectif } from '../lib/effectifPublish.js';

const HOST = 'emeriamc.mine.gg';
const PORT = 10006;

async function ensureTable(): Promise<void> {
  await db()`
    create table if not exists staff_presence (
      pseudo text primary key,
      online boolean not null default false,
      since timestamptz not null default now()
    )
  `;
}

/** Liste complète des joueurs en ligne (pas un échantillon). */
async function onlineList(): Promise<string[]> {
  try {
    const r = await queryFull(HOST, PORT, { timeout: 5000 });
    return r.players?.list ?? [];
  } catch {
    return [];
  }
}

/**
 * Met à jour le statut en ligne/hors ligne de chaque staff. On ne touche `since`
 * QUE lorsque le statut CHANGE (sinon la durée "depuis" repartirait à zéro).
 * Si au moins un staff a changé de statut, on republie l'effectif tout de suite.
 */
async function tick(client: Client): Promise<void> {
  if (!hasDatabase()) return;
  const online = await onlineList();
  const onlineSet = new Set(online.map((p) => p.toLowerCase()));

  const staff = await db()<{ pseudo: string }[]>`select pseudo from staff where active = true`;
  const stored = await db()<{ pseudo: string; online: boolean }[]>`select pseudo, online from staff_presence`;
  const storedMap = new Map(stored.map((s) => [s.pseudo.toLowerCase(), s.online]));

  let changed = false;
  for (const s of staff) {
    const isOnline = onlineSet.has(s.pseudo.toLowerCase());
    const prev = storedMap.get(s.pseudo.toLowerCase());
    if (prev === undefined) {
      await db()`
        insert into staff_presence (pseudo, online, since) values (${s.pseudo}, ${isOnline}, now())
        on conflict (pseudo) do update set online = ${isOnline}, since = now()
      `;
      changed = true;
    } else if (prev !== isOnline) {
      await db()`update staff_presence set online = ${isOnline}, since = now() where lower(pseudo) = lower(${s.pseudo})`;
      changed = true;
    }
  }

  if (changed) await publishEffectif(client).catch(() => {});
}

/** Suit en temps réel qui est en ligne parmi le staff (pour l'effectif). */
export function startStaffPresence(client: Client): void {
  if (!hasDatabase()) {
    console.log('[presence] pas de base → désactivé');
    return;
  }
  ensureTable().catch((e) => console.error('[presence] table', e));
  console.log('[presence] suivi en ligne/hors ligne du staff démarré (1 min)');
  setInterval(() => {
    tick(client).catch((e) => console.error('[presence]', e));
  }, 60_000);
}
