import { db } from '@xo/db';
import bcrypt from 'bcryptjs';

export interface Account {
  id: string;
  username: string;
  site_grade: string;
  is_founder_chief: boolean;
  minecraft_pseudo: string | null;
  avatar_url: string | null;
}

/** Compte "public" renvoyé au client (jamais le hash) */
export function publicAccount(a: Account) {
  return {
    username: a.username,
    site_grade: a.site_grade,
    is_founder_chief: a.is_founder_chief,
    minecraft_pseudo: a.minecraft_pseudo,
    avatar_url: a.avatar_url,
  };
}

export async function findByUsername(username: string): Promise<(Account & { password_hash: string }) | null> {
  const rows = await db()<(Account & { password_hash: string })[]>`
    select id, username, password_hash, site_grade, is_founder_chief, minecraft_pseudo, avatar_url
    from accounts where lower(username) = lower(${username})
  `;
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<Account | null> {
  const rows = await db()<Account[]>`
    select id, username, site_grade, is_founder_chief, minecraft_pseudo, avatar_url
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
    returning id, username, site_grade, is_founder_chief, minecraft_pseudo, avatar_url
  `;
  return rows[0]!;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
