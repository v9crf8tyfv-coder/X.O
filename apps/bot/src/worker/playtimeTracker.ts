import { queryFull } from 'minecraft-server-util';
import { db, hasDatabase } from '@xo/db';

const HOST = 'emeriamc.mine.gg';
const PORT = 10006;
const EVERY_MS = 60_000; // 1 min -> on ajoute 1 min de jeu à chaque staff en ligne

/** Date du jour au format YYYY-MM-DD, fuseau Europe/Paris. */
function parisDay(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

async function ensureTable(): Promise<void> {
  await db()`
    create table if not exists playtime (
      pseudo text not null,
      day date not null,
      minutes integer not null default 0,
      primary key (pseudo, day)
    )
  `;
}

async function tick(): Promise<void> {
  if (!hasDatabase()) return;

  // Qui est en ligne ?
  let online: string[] = [];
  try {
    const res = await queryFull(HOST, PORT, { timeout: 5000 });
    online = res.players?.list ?? [];
  } catch {
    return; // serveur hors ligne -> on ne compte rien
  }
  if (online.length === 0) return;

  // Les staffs actifs (on ne traque que le staff)
  const staff = await db()<{ pseudo: string }[]>`select pseudo from staff where active = true`;
  const staffSet = new Set(staff.map((s) => s.pseudo.toLowerCase()));

  const day = parisDay();
  for (const name of online) {
    if (!staffSet.has(name.toLowerCase())) continue;
    await db()`
      insert into playtime (pseudo, day, minutes) values (${name}, ${day}, 1)
      on conflict (pseudo, day) do update set minutes = playtime.minutes + 1
    `;
  }
}

/** Cumule le temps de jeu (minutes/jour) de chaque staff en ligne. */
export function startPlaytimeTracker(): void {
  if (!hasDatabase()) {
    console.log('[playtime] pas de base → désactivé');
    return;
  }
  ensureTable().catch((e) => console.error('[playtime] table', e));
  console.log('[playtime] traqueur démarré (1 min)');
  setInterval(() => {
    tick().catch((e) => console.error('[playtime]', e));
  }, EVERY_MS);
}
