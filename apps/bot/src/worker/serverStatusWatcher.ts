import type { Client } from 'discord.js';
import { status } from 'minecraft-server-util';
import { db, hasDatabase } from '@xo/db';
import { postStatus } from '../lib/serverStatus.js';

const HOST = 'emeriamc.mine.gg';
const PORT = 10006;
const STATE_KEY = 'server_online';

// Anti-flap (évite de ping en boucle, surtout pendant une maintenance où le serveur
// répond par intermittence). On ne CHANGE l'état annoncé qu'après plusieurs résultats
// IDENTIQUES d'affilée, dans LES DEUX SENS (avant, OPEN était instantané -> flap + spam).
const FAIL_THRESHOLD = 3; // CLOSE confirmé après 3 échecs d'affilée (~60s)
const OK_THRESHOLD = 2;   // OPEN confirmé après 2 succès d'affilée (~40s)
let consecutiveFails = 0;
let consecutiveOks = 0;

// Ping avec re-tentatives : un timeout isolé ne compte pas comme un échec.
async function ping(): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    try {
      await status(HOST, PORT, { timeout: 4000 });
      return true;
    } catch {
      /* on réessaie */
    }
  }
  return false;
}

async function check(client: Client): Promise<void> {
  const up = await ping();
  if (up) {
    consecutiveOks++;
    consecutiveFails = 0;
  } else {
    consecutiveFails++;
    consecutiveOks = 0;
  }

  // État CONFIRMÉ seulement : sinon on attend (pas de post, pas de ping).
  let confirmed: boolean | null = null;
  if (up && consecutiveOks >= OK_THRESHOLD) confirmed = true;
  else if (!up && consecutiveFails >= FAIL_THRESHOLD) confirmed = false;
  if (confirmed === null) return;

  const online = confirmed;
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
