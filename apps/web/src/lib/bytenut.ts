import { db } from '@xo/db';

const STATE_KEY = 'bytenut_timer';

export interface BytenutStatus {
  active: boolean;
  remainingSec: number; // 0 si aucun timer / en attente du bouton
  activeSec: number;
  renewalSec: number;
  at: number | null;
}

/** Lit l'état du timer Bytenut (table partagée bot_state). */
export async function getBytenutStatus(): Promise<BytenutStatus> {
  const rows = await db()<{ value: string }[]>`
    select value from bot_state where key = ${STATE_KEY}
  `;
  if (!rows.length) {
    return { active: false, remainingSec: 0, activeSec: 0, renewalSec: 0, at: null };
  }
  try {
    const s = JSON.parse(rows[0]!.value) as {
      at: number | null;
      activeSec: number;
      renewalSec: number;
    };
    const remainingSec = s.at != null ? Math.max(0, Math.round((s.at - Date.now()) / 1000)) : 0;
    return {
      active: s.at != null,
      remainingSec,
      activeSec: s.activeSec ?? 0,
      renewalSec: s.renewalSec ?? 0,
      at: s.at ?? null,
    };
  } catch {
    return { active: false, remainingSec: 0, activeSec: 0, renewalSec: 0, at: null };
  }
}

/** Supprime le timer. Le bot le coupe tout seul (réconciliation) sous ~8s. */
export async function resetBytenut(): Promise<void> {
  await db()`delete from bot_state where key = ${STATE_KEY}`;
}
