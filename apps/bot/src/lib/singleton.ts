import { randomUUID } from 'node:crypto';
import { db, hasDatabase } from '@xo/db';

/**
 * Verrou "instance unique" : empêche DEUX process du bot de tourner en même temps
 * (l'hébergeur relance parfois sans tuer l'ancien → 2 connexions Discord qui se
 * battent = commandes mortes, effectif/accueil en double, candidatures en triple,
 * absences fantômes…). On pose un verrou en base ; la 2ᵉ instance s'arrête.
 */

const INSTANCE = randomUUID();
const STALE_SECONDS = 45; // un verrou plus vieux que ça = instance morte → récupérable
let heartbeat: NodeJS.Timeout | null = null;

/** Tente d'acquérir le verrou. Renvoie true si on est la SEULE instance vivante. */
export async function acquireLock(): Promise<boolean> {
  if (!hasDatabase()) return true; // pas de base → pas de verrou possible, on laisse tourner
  try {
    await db()`create table if not exists bot_lock (
      id int primary key,
      instance text not null,
      beat timestamptz not null default now()
    )`;
    const rows = await db()<{ instance: string }[]>`
      insert into bot_lock (id, instance, beat) values (1, ${INSTANCE}, now())
      on conflict (id) do update set instance = ${INSTANCE}, beat = now()
      where bot_lock.beat < now() - ${`${STALE_SECONDS} seconds`}::interval
         or bot_lock.instance = ${INSTANCE}
      returning instance
    `;
    return rows.length > 0 && rows[0]!.instance === INSTANCE;
  } catch (e) {
    console.error('[singleton] verrou indisponible, on continue sans:', e instanceof Error ? e.message : e);
    return true; // en cas d'erreur DB, on ne bloque pas le bot
  }
}

/** Rafraîchit le verrou régulièrement pour signaler que cette instance est vivante. */
export function startHeartbeat(): void {
  if (!hasDatabase() || heartbeat) return;
  heartbeat = setInterval(() => {
    db()`update bot_lock set beat = now() where instance = ${INSTANCE}`.catch(() => {});
  }, 15_000);
}
