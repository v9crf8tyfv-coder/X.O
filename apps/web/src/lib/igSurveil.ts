import { db, hasDatabase } from '@xo/db';

/**
 * Surveillance des actions faites DEPUIS LE PANEL (ex : cartes staff par les respo).
 * On insère dans la même table `ig_actions` que les actions en jeu : le worker du bot
 * (igActionsWatcher) la relaie dans le bon salon de surveillance, en routant par le grade
 * de l'acteur. Les actions d'un fondateur ne sont donc pas loggées (catégorie « none »),
 * comme pour le reste de la surveillance.
 *
 * `actor` doit être le PSEUDO de l'acteur (Minecraft) pour que le grade soit retrouvé.
 */
export async function igSurveil(
  actor: string | null | undefined,
  action: string,
  target?: string | null,
  details?: string | null,
  source = 'site',
): Promise<void> {
  if (!hasDatabase() || !actor) return;
  try {
    await db()`
      create table if not exists ig_actions (
        id bigserial primary key,
        actor text not null,
        action text not null,
        target text,
        details text,
        source text,
        created_at timestamptz not null default now(),
        processed boolean not null default false
      )
    `;
    await db()`alter table ig_actions add column if not exists source text`;
    await db()`
      insert into ig_actions (actor, action, target, details, source)
      values (${actor.slice(0, 64)}, ${action.slice(0, 128)},
              ${target ? target.slice(0, 128) : null}, ${details ? details.slice(0, 1000) : null}, ${source})
    `;
  } catch {
    /* surveillance best-effort : ne jamais bloquer l'action */
  }
}
