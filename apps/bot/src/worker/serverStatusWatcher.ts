import type { Client } from 'discord.js';
import { status } from 'minecraft-server-util';
import { db, hasDatabase } from '@xo/db';
import { postStatus } from '../lib/serverStatus.js';

const HOST = 'emeriamc.mine.gg';
const PORT = 10006;
const STATE_KEY = 'server_online';

// Anti-spam : le serveur peut rater un ping ponctuellement (lag, pré-génération Chunky…).
// On n'annonce CLOSE qu'après FAIL_THRESHOLD pings ratés d'affilée. OPEN reste immédiat.
const FAIL_THRESHOLD = 2;
let consecutiveFails = 0;

async function ping(): Promise<boolean> {
  try {
    await status(HOST, PORT, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function check(client: Client): Promise<void> {
  const up = await ping();
  if (up) {
    consecutiveFails = 0;
  } else {
    consecutiveFails++;
    // Pas encore sûr que le serveur soit vraiment down → on attend, sans rien poster.
    if (consecutiveFails < FAIL_THRESHOLD) return;
  }
  const online = up;
  const cur = online ? '1' : '0';

  let prev: string | null = null;
  if (hasDatabase()) {
    const rows = await db()<{ value: string }[]>`select value from bot_state where key = ${STATE_KEY}`;
    prev = rows.length ? rows[0]!.value : null;
  }
  if (prev === cur) return; // pas de changement d'état

  await postStatus(client, online);
  if (hasDatabase()) {
    await db()`
      insert into bot_state (key, value) values (${STATE_KEY}, ${cur})
      on conflict (key) do update set value = excluded.value
    `;
  }
}

/** Surveille automatiquement l'état du serveur MC et poste OPEN/CLOSE au changement. */
export function startServerStatusWatcher(client: Client): void {
  const run = () => check(client).catch((e) => console.error('[status]', e));
  setTimeout(run, 8_000); // premier check au démarrage
  setInterval(run, 20_000); // puis toutes les 20s (CLOSE confirmé en ~40s, OPEN instantané)
}
