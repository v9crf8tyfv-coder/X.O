import { db } from '@xo/db';

export interface AutoRole {
  id: string;
  role_id: string;
  label: string | null;
}

export interface DiscordRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed: boolean;
}

/**
 * Liste EN DIRECT tous les rôles du serveur Discord (API REST, token du bot).
 * Sert à détecter automatiquement les rôles créés/supprimés côté Discord.
 * Renvoie [] si le token/guild ne sont pas configurés ou en cas d'erreur.
 */
export async function listDiscordRoles(): Promise<DiscordRole[]> {
  const token = process.env.DISCORD_TOKEN;
  const guild = process.env.DISCORD_GUILD_ID;
  if (!token || !guild) return [];
  try {
    const r = await fetch(`https://discord.com/api/v10/guilds/${guild}/roles`, {
      headers: { Authorization: `Bot ${token}` },
      cache: 'no-store',
    });
    if (!r.ok) return [];
    const roles = (await r.json()) as DiscordRole[];
    return roles
      .filter((role) => role.name !== '@everyone' && !role.managed) // exclut @everyone + rôles de bots/intégrations
      .sort((a, b) => b.position - a.position); // du plus haut au plus bas
  } catch {
    return [];
  }
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
