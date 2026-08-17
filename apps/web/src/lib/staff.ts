import { db } from '@xo/db';
import { highestGrade } from './accounts';
import { syncGradeToGame, resetGradeInGame } from './luckpermsSync';

export interface StaffRecord {
  id: string;
  type: string; // 'warn' | 'blame' | 'note'
  reason: string | null;
  issued_by: string | null;
  created_at: string;
}

export interface Staff {
  id: string;
  pseudo: string; // pseudo Minecraft (IG) — sert à l'effectif
  discord_tag: string;
  site_username: string | null;
  grades: string[];
  is_absent: boolean;
  records: StaffRecord[];
}

/** Liste des staffs actifs, avec leurs dossiers (warns/blames/notes) */
export async function listStaff(): Promise<Staff[]> {
  const staff = await db()<Omit<Staff, 'records'>[]>`
    select id, pseudo, discord_tag, site_username, grades, is_absent
    from staff where active = true
    order by created_at asc
  `;
  if (staff.length === 0) return [];
  const ids = staff.map((s) => s.id);
  const records = await db()<(StaffRecord & { staff_id: string })[]>`
    select id, staff_id, type, reason, issued_by,
           to_char(created_at at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as created_at
    from staff_records where staff_id = any(${ids}) order by created_at desc
  `;
  return staff.map((s) => ({
    ...s,
    records: records.filter((r) => r.staff_id === s.id),
  }));
}

/** Cherche un staff actif par tag Discord OU pseudo (pour éviter les doublons) */
export async function findActiveStaff(discordTag: string, pseudo: string): Promise<Staff | null> {
  const rows = await db()<Omit<Staff, 'records'>[]>`
    select id, pseudo, discord_tag, site_username, grades, is_absent
    from staff
    where active = true
      and (lower(discord_tag) = lower(${discordTag}) or lower(pseudo) = lower(${pseudo}))
    limit 1
  `;
  return rows[0] ? { ...rows[0], records: [] } : null;
}

export async function createStaff(params: {
  minecraftPseudo: string;
  discordTag: string;
  siteUsername: string | null;
  grades: string[];
}): Promise<Staff> {
  const primary = highestGrade(params.grades);
  const rows = await db()<Omit<Staff, 'records'>[]>`
    insert into staff (pseudo, discord_tag, site_username, primary_grade, grades)
    values (${params.minecraftPseudo}, ${params.discordTag}, ${params.siteUsername},
            ${primary}, ${params.grades})
    returning id, pseudo, discord_tag, site_username, grades, is_absent
  `;
  return { ...rows[0]!, records: [] };
}

/** Met à jour les grades d'un staff (recalcule primary_grade) */
export async function setStaffGrades(id: string, grades: string[]): Promise<void> {
  const primary = highestGrade(grades);
  await db()`update staff set grades = ${grades}, primary_grade = ${primary} where id = ${id}`;
}

export async function getStaff(id: string): Promise<Staff | null> {
  const rows = await db()<Omit<Staff, 'records'>[]>`
    select id, pseudo, discord_tag, site_username, grades, is_absent
    from staff where id = ${id} and active = true
  `;
  if (!rows[0]) return null;
  const records = await db()<StaffRecord[]>`
    select id, type, reason, issued_by,
           to_char(created_at at time zone 'Europe/Paris', 'DD/MM/YYYY HH24:MI') as created_at
    from staff_records where staff_id = ${id} order by created_at desc
  `;
  return { ...rows[0], records };
}

export async function addRecord(params: {
  staffId: string;
  type: 'warn' | 'blame' | 'note';
  reason: string;
  issuedBy: string;
}): Promise<void> {
  await db()`
    insert into staff_records (staff_id, type, reason, issued_by)
    values (${params.staffId}, ${params.type}, ${params.reason}, ${params.issuedBy})
  `;
}

export async function deleteRecord(recordId: string): Promise<void> {
  await db()`delete from staff_records where id = ${recordId}`;
}

/** Retire quelqu'un du staff (soft) → l'historique reste */
export async function removeStaff(id: string): Promise<Staff | null> {
  const rows = await db()<Omit<Staff, 'records'>[]>`
    update staff set active = false, removed_at = now()
    where id = ${id} returning id, pseudo, discord_tag, site_username, grades, is_absent
  `;
  return rows[0] ? { ...rows[0], records: [] } : null;
}

/**
 * Synchronise l'accès SITE du compte lié (par pseudo site) sur des grades.
 * grades = [] → repasse joueur.
 */
// Comptes protégés : ne peuvent jamais être modifiés via la Gestion Staff/effectif
const PROTECTED = ['ixtazzking'];
export function isProtected(name: string | null | undefined): boolean {
  return !!name && PROTECTED.includes(name.toLowerCase());
}

export async function syncSiteAccess(siteUsername: string | null, grades: string[]): Promise<void> {
  if (!siteUsername || isProtected(siteUsername)) return; // proprio jamais deranké
  const primary = highestGrade(grades);
  await db()`
    update accounts set site_grades = ${grades}, site_grade = ${primary}
    where lower(username) = lower(${siteUsername})
  `;
}

/**
 * Met une action en file pour que le BOT l'applique (rôles Discord, IG plus tard,
 * effectif). type: 'staff.apply' | 'staff.remove'.
 */
export async function queueAction(params: {
  type: 'staff.apply' | 'staff.remove';
  discordTag: string;
  minecraftPseudo: string;
  grades: string[];
  actor: string; // pseudo SITE de celui qui fait l'action (surveillance)
  actorGrade: string; // son grade site (détermine le salon de surveillance)
  announce?: boolean; // true = poste le message de félicitations (promotion/création)
}): Promise<void> {
  await db()`
    insert into pending_actions (type, discord_tag, minecraft_pseudo, grades, actor, actor_grade, announce)
    values (${params.type}, ${params.discordTag}, ${params.minecraftPseudo}, ${params.grades},
            ${params.actor}, ${params.actorGrade}, ${params.announce ?? false})
  `;

  // Applique AUSSI le grade EN JEU (LuckPerms via MySQL). N'échoue jamais l'action.
  try {
    if (params.type === 'staff.remove') {
      await resetGradeInGame(params.minecraftPseudo);
    } else {
      await syncGradeToGame(params.minecraftPseudo, params.grades);
    }
  } catch (e) {
    console.error('[IG sync]', params.minecraftPseudo, e instanceof Error ? e.message : e);
  }
}
