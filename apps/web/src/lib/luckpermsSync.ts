/**
 * Synchro des grades PANEL -> EN JEU (IG), via le MySQL d'OMGserv.
 *
 * Tourne côté SITE (Vercel) — pas dans le bot (qui est limité en RAM).
 * Quand une carte staff change de grade, on écrit le bon groupe LuckPerms
 * directement dans le MySQL. LuckPerms le relit tout seul (sync-minutes=1).
 *
 * Variables d'env requises (sur Vercel) :
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 *   LP_TABLE_PREFIX (optionnel, défaut luckperms_)
 *
 * Si absentes -> synchro IG ignorée (Discord + site marchent quand même).
 */
import { createPool, type Pool } from 'mysql2/promise';
import { getGrade } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';

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
  modo_test: 'modo', // Modérateur test -> groupe modo en jeu
  modo_x: 'modo',    // Modérateur X -> groupe modo en jeu
  com: 'com/g',
  betatesteur: 'béta-test',
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
    connectionLimit: 2,
    connectTimeout: 8000,
  });
  return pool;
}

/** Formate un UUID (avec ou sans tirets) au format LuckPerms (avec tirets). */
function dashed(id: string): string | null {
  const raw = id.replace(/-/g, '');
  if (raw.length !== 32) return null;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20)}`;
}

/** UUID depuis la base (fiable, backfillé) : staff/accounts. null si absent. */
async function uuidFromDb(pseudo: string): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    const rows = await db()<{ u: string | null }[]>`
      select coalesce(
        (select minecraft_uuid from staff where lower(pseudo)=lower(${pseudo}) and minecraft_uuid is not null limit 1),
        (select minecraft_uuid from accounts where lower(minecraft_pseudo)=lower(${pseudo}) and minecraft_uuid is not null limit 1)
      ) as u
    `;
    const id = rows[0]?.u;
    return id ? dashed(id) : null;
  } catch {
    return null;
  }
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

/** TOUS les groupes LuckPerms d'un staff (un par grade mappé) + le groupe principal (le + haut). */
function lpGroups(grades: string[]): { groups: string[]; primary: string } {
  const set = new Set<string>();
  let primary: string | null = null;
  let bestLevel = -1;
  for (const g of grades) {
    const lp = LP_GROUP[g];
    if (!lp) continue;
    set.add(lp);
    if (getGrade(g).level > bestLevel) { primary = lp; bestLevel = getGrade(g).level; }
  }
  return { groups: [...set], primary: primary ?? 'default' };
}

/** Donne TOUS les groupes au joueur dans LuckPerms (comme plusieurs `lp user X parent add G`). */
async function setGroups(pseudo: string, groups: string[], primary: string): Promise<void> {
  const p = getPool();
  if (!p) return;
  // UUID depuis la base d'abord (fiable), Mojang en secours (évite le rate-limit).
  const uuid = (await uuidFromDb(pseudo)) ?? (await fetchUuid(pseudo));
  if (!uuid) throw new Error(`UUID introuvable pour "${pseudo}" (compte premium ?)`);
  const players = `${PREFIX}players`;
  const perms = `${PREFIX}user_permissions`;
  const conn = await p.getConnection();
  try {
    await conn.query(
      `INSERT INTO \`${players}\` (uuid, username, primary_group) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE username=VALUES(username), primary_group=VALUES(primary_group)`,
      [uuid, pseudo, primary],
    );
    // On repart propre : on retire tous les group.* puis on remet CHAQUE groupe voulu.
    await conn.query(`DELETE FROM \`${perms}\` WHERE uuid=? AND permission LIKE 'group.%'`, [uuid]);
    for (const group of groups) {
      await conn.query(
        `INSERT INTO \`${perms}\` (uuid, permission, value, server, world, expiry, contexts)
         VALUES (?, ?, 1, 'global', 'global', 0, '{}')`,
        [uuid, `group.${group}`],
      );
    }
  } finally {
    conn.release();
  }
}

/** staff.apply -> applique TOUS les groupes des grades (1 par grade). 'default' si aucun mappé. */
export async function syncGradeToGame(pseudo: string, grades: string[]): Promise<void> {
  if (!getPool()) return;
  const { groups, primary } = lpGroups(grades);
  if (groups.length === 0) { await setGroups(pseudo, ['default'], 'default'); return; }
  await setGroups(pseudo, groups, primary);
}

/** staff.remove -> repasse le joueur en groupe 'default'. */
export async function resetGradeInGame(pseudo: string): Promise<void> {
  if (!getPool()) return;
  await setGroups(pseudo, ['default'], 'default');
}

/**
 * Grades RP en jeu : applique/retire UNIQUEMENT les groupes LuckPerms RP (necromancien, mage…)
 * sans toucher aux groupes staff du joueur. Les noms de groupes LP = les clés des grades RP.
 */
export async function syncRpToGame(pseudo: string, rpGrades: string[]): Promise<void> {
  const p = getPool();
  if (!p) return;
  const { RP_GRADES } = await import('@xo/shared');
  const rpGroups = Object.keys(RP_GRADES);
  const wanted = new Set(rpGrades.filter((g) => rpGroups.includes(g)));
  const uuid = (await uuidFromDb(pseudo)) ?? (await fetchUuid(pseudo));
  if (!uuid) throw new Error(`UUID introuvable pour "${pseudo}"`);
  const perms = `${PREFIX}user_permissions`;
  const players = `${PREFIX}players`;
  const conn = await p.getConnection();
  try {
    // Le joueur doit exister dans players (sans changer son primary_group staff).
    await conn.query(
      `INSERT IGNORE INTO \`${players}\` (uuid, username, primary_group) VALUES (?, ?, 'default')`,
      [uuid, pseudo],
    );
    // Retire UNIQUEMENT les groupes RP non voulus (les groupes staff ne sont pas touchés).
    for (const g of rpGroups) {
      if (!wanted.has(g)) {
        await conn.query(`DELETE FROM \`${perms}\` WHERE uuid=? AND permission=?`, [uuid, `group.${g}`]);
      }
    }
    // Ajoute les groupes RP voulus (sans doublon).
    for (const g of wanted) {
      await conn.query(
        `INSERT INTO \`${perms}\` (uuid, permission, value, server, world, expiry, contexts)
         SELECT ?, ?, 1, 'global', 'global', 0, '{}' FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM \`${perms}\` WHERE uuid=? AND permission=?)`,
        [uuid, `group.${g}`, uuid, `group.${g}`],
      );
    }
  } finally {
    conn.release();
  }
}
