import { db } from '@xo/db';

export interface Staff {
  id: string;
  pseudo: string;
  discord_tag: string;
  discord_id: string | null;
  primary_grade: string;
  is_absent: boolean;
  join_count: number;
}

export async function listStaff(): Promise<Staff[]> {
  return db()<Staff[]>`
    select id, pseudo, discord_tag, discord_id, primary_grade, is_absent, join_count
    from staff where active = true
    order by created_at asc
  `;
}

export async function createStaff(params: {
  pseudo: string;
  discordTag: string;
  grade: string;
}): Promise<Staff> {
  const rows = await db()<Staff[]>`
    insert into staff (pseudo, discord_tag, primary_grade)
    values (${params.pseudo}, ${params.discordTag}, ${params.grade})
    returning id, pseudo, discord_tag, discord_id, primary_grade, is_absent, join_count
  `;
  return rows[0]!;
}

/** Retrait "soft" : le staff disparaît de la liste mais l'historique reste */
export async function removeStaff(id: string): Promise<void> {
  await db()`update staff set active = false, removed_at = now() where id = ${id}`;
}
