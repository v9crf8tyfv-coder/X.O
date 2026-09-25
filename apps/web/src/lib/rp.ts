import { db } from '@xo/db';
import { RP_GRADES } from '@xo/shared';
import { syncRpToGame } from './luckpermsSync';

export interface RpRecord {
  id: string;
  type: string; // 'warn' | 'blame' | 'note'
  reason: string | null;
  issued_by: string | null;
  created_at: string;
}

export interface RpMember {
  id: string;
  pseudo: string; // pseudo Minecraft (IG)
  discord_tag: string | null;
  grades: string[]; // grades RP (necromancien, mage…)
  records: RpRecord[];
}

/** Crée les tables RP si besoin (membres RP + dossiers). RP = joueurs, indépendant du staff. */
export async function ensureRpTables(): Promise<void> {
  await db()`
    create table if not exists rp_members (
      id uuid primary key default gen_random_uuid(),
      pseudo text not null,
      discord_tag text,
      grades text[] not null default '{}',
      active boolean not null default true,
      created_at timestamptz not null default now(),
      removed_at timestamptz
    )
  `;
  await db()`
    create table if not exists rp_records (
      id uuid primary key default gen_random_uuid(),
      member_id uuid not null references rp_members(id) on delete cascade,
      type text not null,
      reason text,
      issued_by text,
      created_at timestamptz not null default now()
    )
  `;
}

const VALID = new Set(Object.keys(RP_GRADES));
/** Ne garde que des grades RP connus. */
export function cleanRpGrades(grades: string[]): string[] {
  return [...new Set((grades ?? []).filter((g) => VALID.has(g)))];
}

export async function listRp(): Promise<RpMember[]> {
  await ensureRpTables();
  const members = await db()<Omit<RpMember, 'records'>[]>`
    select id, pseudo, discord_tag, grades from rp_members where active = true order by created_at asc
  `;
  if (members.length === 0) return [];
  const ids = members.map((m) => m.id);
  const records = await db()<(RpRecord & { member_id: string })[]>`
    select id, member_id, type, reason, issued_by,
           to_char(created_at at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as created_at
    from rp_records where member_id = any(${ids}) order by created_at desc
  `;
  return members.map((m) => ({ ...m, records: records.filter((r) => r.member_id === m.id) }));
}

export async function findActiveRp(pseudo: string): Promise<RpMember | null> {
  await ensureRpTables();
  const rows = await db()<Omit<RpMember, 'records'>[]>`
    select id, pseudo, discord_tag, grades from rp_members
    where active = true and lower(pseudo) = lower(${pseudo}) limit 1
  `;
  return rows[0] ? { ...rows[0], records: [] } : null;
}

export async function createRp(params: {
  pseudo: string;
  discordTag: string | null;
  grades: string[];
}): Promise<RpMember> {
  await ensureRpTables();
  const grades = cleanRpGrades(params.grades);
  const rows = await db()<Omit<RpMember, 'records'>[]>`
    insert into rp_members (pseudo, discord_tag, grades)
    values (${params.pseudo}, ${params.discordTag}, ${grades})
    returning id, pseudo, discord_tag, grades
  `;
  return { ...rows[0]!, records: [] };
}

export async function getRp(id: string): Promise<RpMember | null> {
  const rows = await db()<Omit<RpMember, 'records'>[]>`
    select id, pseudo, discord_tag, grades from rp_members where id = ${id} and active = true
  `;
  if (!rows[0]) return null;
  const records = await db()<RpRecord[]>`
    select id, type, reason, issued_by,
           to_char(created_at at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as created_at
    from rp_records where member_id = ${id} order by created_at desc
  `;
  return { ...rows[0], records };
}

export async function setRpGrades(id: string, grades: string[]): Promise<void> {
  await db()`update rp_members set grades = ${cleanRpGrades(grades)} where id = ${id}`;
}

export async function addRpRecord(params: {
  memberId: string;
  type: 'warn' | 'blame' | 'note';
  reason: string;
  issuedBy: string;
}): Promise<void> {
  await db()`
    insert into rp_records (member_id, type, reason, issued_by)
    values (${params.memberId}, ${params.type}, ${params.reason}, ${params.issuedBy})
  `;
}

export async function deleteRpRecord(recordId: string): Promise<void> {
  await db()`delete from rp_records where id = ${recordId}`;
}

export async function removeRp(id: string): Promise<RpMember | null> {
  const rows = await db()<Omit<RpMember, 'records'>[]>`
    update rp_members set active = false, removed_at = now()
    where id = ${id} returning id, pseudo, discord_tag, grades
  `;
  return rows[0] ? { ...rows[0], records: [] } : null;
}

/** File une action pour que le BOT applique les rôles Discord RP. type: 'rp.apply' | 'rp.remove'. */
export async function queueRpAction(params: {
  type: 'rp.apply' | 'rp.remove';
  discordTag: string | null;
  pseudo: string;
  grades: string[];
}): Promise<void> {
  // 1) EN JEU (LuckPerms) : applique/retire les groupes RP tout de suite. N'échoue jamais l'action.
  try {
    await syncRpToGame(params.pseudo, params.type === 'rp.remove' ? [] : params.grades);
  } catch (e) {
    console.error('[RP IG sync]', params.pseudo, e instanceof Error ? e.message : e);
  }
  // 2) DISCORD (via le bot) : uniquement si un compte Discord est lié.
  if (!params.discordTag) return;
  await db()`
    insert into pending_actions (type, discord_tag, minecraft_pseudo, grades, actor, actor_grade, announce)
    values (${params.type}, ${params.discordTag}, ${params.pseudo}, ${params.grades}, 'rp', 'rp', false)
  `;
}
