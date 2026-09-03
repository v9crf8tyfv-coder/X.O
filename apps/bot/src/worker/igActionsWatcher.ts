import type { Client } from 'discord.js';
import { db, hasDatabase } from '@xo/db';
import { getGrade, type SurveillanceCategory } from '@xo/shared';
import { logSurveillance } from '../lib/surveillance.js';

const EVERY_MS = 30_000;

interface IgAction {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  details: string | null;
}

async function ensureTable(): Promise<void> {
  await db()`
    create table if not exists ig_actions (
      id bigserial primary key,
      actor text not null,
      action text not null,
      target text,
      details text,
      created_at timestamptz not null default now(),
      processed boolean not null default false
    )
  `;
}

/** Catégorie de surveillance d'un pseudo MC (via sa fiche staff / compte). */
async function categoryForPseudo(pseudo: string): Promise<SurveillanceCategory> {
  const staff = await db()<{ grades: string[] }[]>`
    select grades from staff where lower(pseudo) = lower(${pseudo}) and active = true limit 1
  `;
  let grades = staff[0]?.grades ?? [];
  if (grades.length === 0) {
    const acc = await db()<{ site_grades: string[] }[]>`
      select site_grades from accounts where lower(minecraft_pseudo) = lower(${pseudo}) limit 1
    `;
    grades = acc[0]?.site_grades ?? [];
  }
  let best: SurveillanceCategory = 'none';
  let lvl = -1;
  for (const gk of grades) {
    const g = getGrade(gk);
    if (g.level > lvl) {
      lvl = g.level;
      best = g.surveillance;
    }
  }
  return best;
}

async function tick(client: Client): Promise<void> {
  if (!hasDatabase()) return;
  const rows = await db()<IgAction[]>`
    select id::text as id, actor, action, target, details
    from ig_actions where processed = false order by id asc limit 25
  `;
  for (const r of rows) {
    try {
      const category = await categoryForPseudo(r.actor);
      if (category !== 'none') {
        await logSurveillance(client, {
          category,
          action: r.action,
          actor: r.actor,
          target: r.target,
          source: 'ig',
          fields: r.details ? [{ name: 'Détails', value: r.details.slice(0, 1000) }] : undefined,
        });
      }
    } catch (e) {
      console.error('[ig-surveillance] relais échoué:', e);
    }
    await db()`update ig_actions set processed = true where id = ${r.id}`;
  }
}

/** Relaie les actions staff EN JEU (mute/jail/...) vers le bon salon de surveillance. */
export function startIgActionsWatcher(client: Client): void {
  if (!hasDatabase()) {
    console.log('[ig-surveillance] pas de base → désactivé');
    return;
  }
  ensureTable().catch((e) => console.error('[ig-surveillance] table', e));
  console.log('[ig-surveillance] relai démarré (15s)');
  setInterval(() => {
    tick(client).catch((e) => console.error('[ig-surveillance]', e));
  }, EVERY_MS);
}
