import { db, hasDatabase } from '@xo/db';

// Cache court pour ne pas taper la base à chaque requête
let cache = { blocked: false, at: 0 };

/** Le site est-il verrouillé (/blockfull) ? Lu depuis bot_state, caché ~5s. */
export async function isSiteBlocked(): Promise<boolean> {
  if (!hasDatabase()) return false;
  const now = Date.now();
  if (now - cache.at < 5000) return cache.blocked;
  try {
    const rows = await db()<{ value: string }[]>`
      select value from bot_state where key = 'site_blocked'
    `;
    cache = { blocked: rows[0]?.value === '1', at: now };
  } catch {
    /* garde la dernière valeur connue */
  }
  return cache.blocked;
}
