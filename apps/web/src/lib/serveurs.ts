import { db } from '@xo/db';

export interface AutoRole {
  id: string;
  role_id: string;
  label: string | null;
}

/** Rôles Discord attribués automatiquement à l'arrivée (config /panel historique) */
export async function listAutoRoles(): Promise<AutoRole[]> {
  return db()<AutoRole[]>`
    select id, role_id, label from panel_auto_roles order by created_at asc
  `;
}

export async function addAutoRole(roleId: string, label: string, createdBy: string): Promise<void> {
  await db()`
    insert into panel_auto_roles (role_id, label, created_by)
    values (${roleId}, ${label}, ${createdBy})
    on conflict (role_id) do update set label = ${label}
  `;
}

export async function removeAutoRole(roleId: string): Promise<void> {
  await db()`delete from panel_auto_roles where role_id = ${roleId}`;
}
