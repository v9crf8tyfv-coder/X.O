/**
 * Synchro des grades PANEL -> EN JEU (IG), via le MySQL d'OMGserv.
 *
 * Quand une carte staff reçoit un grade, le bot écrit le bon groupe LuckPerms
 * directement dans la base MySQL. LuckPerms le relit tout seul (sync-minutes)
 * et l'applique en jeu — sans redémarrer le serveur.
 *
 * Config requise dans le .env du bot :
 *   MYSQL_HOST=...      (host MySQL OMGserv)
 *   MYSQL_PORT=3306
 *   MYSQL_USER=...
 *   MYSQL_PASSWORD=...
 *   MYSQL_DATABASE=...  (ex: minecraft_453249)
 *   LP_TABLE_PREFIX=luckperms_   (optionnel, défaut luckperms_)
 *
 * Si ces variables sont absentes -> la synchro IG est simplement ignorée
 * (Discord + site continuent de marcher normalement).
 */
import { createPool, type Pool } from 'mysql2/promise';
import { getGrade } from '@xo/shared';

/** Grade du panel -> nom du groupe LuckPerms en jeu (d'après `lp listgroups`). */
const LP_GROUP: Record<string, string> = {
  fondateur: 'fondateur',
  cofondateur: 'co-fonda',
  responsable: 'respo',
  resp_admin: 'respo',
  resp_com: 'respo',
  resp_dev: 'respo',
  resp_build: 'respo',
  resp_infra: 'respo',
  resp_systeme: 'respo',
  admin: 'admin',
  dev: 'dev',
  buildeur: 'builder',
  modo: 'modo',
  // com / betatesteur : aucun groupe LP fourni -> ignorés (ajoute-les ici si besoin)
};

const PREFIX = process.env.LP_TABLE_PREFIX || 'luckperms_';
let pool: Pool | null = null;

function getPool(): Pool | null {
  if (pool) return pool;
  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE } = process.env;
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASSWORD || !MYSQL_DATABASE) return null;
  pool = createPool({
    host: MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
    connectionLimit: 3,
    connectTimeout: 8000,
  });
  return pool;
}

export function hasLuckPerms(): boolean {
  return !!getPool();
}

/** UUID Mojang (avec tirets, format LuckPerms) pour un pseudo premium. */
async function fetchUuid(pseudo: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(pseudo)}`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { id?: string };
    const id = j.id;
    if (!id || id.length !== 32) return null;
    return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  } catch {
    return null;
  }
}

/** Groupe LuckPerms du grade le plus haut d'un staff (null si aucun mappé). */
function topLpGroup(grades: string[]): string | null {
  let best: string | null = null;
  let bestLevel = -1;
  for (const g of grades) {
    const lp = LP_GROUP[g];
    if (lp && getGrade(g).level > bestLevel) {
      best = lp;
      bestLevel = getGrade(g).level;
    }
  }
  return best;
}

/** Donne UN seul groupe au joueur dans LuckPerms (comme `lp user X parent set G`). */
async function setGroup(pseudo: string, group: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  const uuid = await fetchUuid(pseudo);
  if (!uuid) throw new Error(`UUID introuvable pour "${pseudo}" (compte premium ?)`);
  const players = `${PREFIX}players`;
  const perms = `${PREFIX}user_permissions`;
  const conn = await p.getConnection();
  try {
    await conn.query(
      `INSERT INTO \`${players}\` (uuid, username, primary_group) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE username=VALUES(username), primary_group=VALUES(primary_group)`,
      [uuid, pseudo, group],
    );
    await conn.query(`DELETE FROM \`${perms}\` WHERE uuid=? AND permission LIKE 'group.%'`, [uuid]);
    await conn.query(
      `INSERT INTO \`${perms}\` (uuid, permission, value, server, world, expiry, contexts)
       VALUES (?, ?, 1, 'global', 'global', 0, '{}')`,
      [uuid, `group.${group}`],
    );
  } finally {
    conn.release();
  }
}

/** staff.apply -> applique le groupe du grade le plus haut. */
export async function syncGradeToGame(pseudo: string, grades: string[]): Promise<void> {
  if (!getPool()) return; // MySQL non configuré -> on ignore
  const group = topLpGroup(grades);
  if (!group) return; // grade sans groupe LP -> on ne touche pas
  await setGroup(pseudo, group);
}

/** staff.remove -> repasse le joueur en groupe 'default'. */
export async function resetGradeInGame(pseudo: string): Promise<void> {
  if (!getPool()) return;
  await setGroup(pseudo, 'default');
}
