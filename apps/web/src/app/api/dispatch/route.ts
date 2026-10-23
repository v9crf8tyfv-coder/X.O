import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';
import { getCurrentAccount } from '@/lib/auth';
import { getGrade, DISPATCH } from '@xo/shared';
import { ADMIN_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

/**
 * Dispatching : le Responsable Com (opresp_com) pose/retire le rôle "didi com" sur le serveur Com ;
 * le Responsable RP (opresp_rp) le rôle "didi rp" sur le serveur RP. Admins et + peuvent les deux.
 * L'action est mise en file (pending_actions) et appliquée par le bot sur le bon serveur.
 */
export async function POST(req: Request) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { tag?: string; side?: string; on?: boolean };
  const side = body.side === 'rp' ? 'rp' : body.side === 'com' ? 'com' : null;
  const tag = String(body.tag ?? '').trim().slice(0, 64);
  const on = !!body.on;
  if (!side || !tag) return NextResponse.json({ error: 'Pseudo Discord et côté (com/rp) requis.' }, { status: 400 });

  const level = getGrade(account.site_grade).level;
  const grades = account.site_grades ?? [];
  const conf = DISPATCH[side];
  const allowed = level >= ADMIN_LEVEL || grades.includes(conf.managerGrade);
  if (!allowed) return NextResponse.json({ error: 'Tu ne peux pas dispatcher ce côté.' }, { status: 403 });

  if (!hasDatabase()) return NextResponse.json({ error: 'no database' }, { status: 500 });
  await db()`
    insert into pending_actions (type, discord_tag, minecraft_pseudo, grades, actor, actor_grade)
    values (${'dispatch.' + side + '.' + (on ? 'add' : 'remove')}, ${tag}, ${''}, ${'[]'}::jsonb, ${account.username}, ${account.site_grade})
  `;
  return NextResponse.json({ ok: true });
}
