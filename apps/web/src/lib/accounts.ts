import { db } from '@xo/db';
import { getGrade } from '@xo/shared';
import bcrypt from 'bcryptjs';

export interface Account {
  id: string;
  username: string;
  site_grade: string; // grade "principal" = le plus haut de site_grades (accès)
  site_grades: string[]; // TOUS les rôles d'accès site
  is_founder_chief: boolean;
  minecraft_pseudo: string | null;
  avatar_url: string | null;
}

/** Grade le plus élevé (par niveau) d'une liste, ou 'joueur' si vide */
export function highestGrade(grades: string[]): string {
  let best = 'joueur';
  let lvl = 0;
  for (const g of grades) {
    const l = getGrade(g).level;
    if (l > lvl) {
      lvl = l;
      best = g;
    }
  }
  return best;
}

/** Compte "public" renvoyé au client (jamais le hash) */
export function publicAccount(a: Account) {
  return {
    username: a.username,
    site_grade: a.site_grade,
    site_grades: a.site_grades ?? [],
    is_founder_chief: a.is_founder_chief,
    minecraft_pseudo: a.minecraft_pseudo,
    avatar_url: a.avatar_url,
  };
}

export async function findByUsername(
  username: string,
): Promise<(Account & { password_hash: string }) | null> {
  const rows = await db()<(Account & { password_hash: string })[]>`
    select id, username, password_hash, site_grade, site_grades, is_founder_chief,
           minecraft_pseudo, avatar_url
    from accounts where lower(username) = lower(${username})
  `;
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<Account | null> {
  const rows = await db()<Account[]>`
    select id, username, site_grade, site_grades, is_founder_chief, minecraft_pseudo, avatar_url
    from accounts where id = ${id}
  `;
  return rows[0] ?? null;
}

export async function createAccount(params: {
  username: string;
  password: string;
  minecraftPseudo: string;
}): Promise<Account> {
  const hash = await bcrypt.hash(params.password, 10);
  const rows = await db()<Account[]>`
    insert into accounts (username, password_hash, minecraft_pseudo)
    values (${params.username}, ${hash}, ${params.minecraftPseudo})
    returning id, username, site_grade, site_grades, is_founder_chief, minecraft_pseudo, avatar_url
  `;
  return rows[0]!;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Tous les comptes du site (pour la Gestion Site) */
export async function listAllAccounts(): Promise<(Account & { created_at: string })[]> {
  return db()<(Account & { created_at: string })[]>`
    select id, username, site_grade, site_grades, is_founder_chief, minecraft_pseudo, avatar_url,
           to_char(created_at, 'YYYY-MM-DD HH24:MI') as created_at
    from accounts
    order by created_at asc
  `;
}

/**
 * Change les rôles d'ACCÈS SITE d'un compte (ne touche ni Discord ni IG).
 * `site_grade` (principal) est recalculé = le grade le plus élevé de la liste.
 */
export async function setAccountGrades(id: string, grades: string[]): Promise<void> {
  const primary = highestGrade(grades);
  await db()`
    update accounts set site_grades = ${grades}, site_grade = ${primary} where id = ${id}
  `;
}
