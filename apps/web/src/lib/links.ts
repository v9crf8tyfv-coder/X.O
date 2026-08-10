import { db } from '@xo/db';

export interface UsefulLink {
  id: string;
  title: string;
  url: string;
  grade: string; // grade destinataire
  created_at: string;
}

export async function listLinks(): Promise<UsefulLink[]> {
  return db()<UsefulLink[]>`
    select id, title, url, grade, to_char(created_at, 'DD/MM/YYYY') as created_at
    from useful_links order by created_at desc
  `;
}

export async function addLink(
  title: string,
  url: string,
  grade: string,
  createdBy: string,
): Promise<void> {
  await db()`
    insert into useful_links (title, url, grade, created_by)
    values (${title}, ${url}, ${grade}, ${createdBy})
  `;
}

export async function removeLink(id: string): Promise<void> {
  await db()`delete from useful_links where id = ${id}`;
}
