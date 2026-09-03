import { NextResponse } from 'next/server';
import { getGrade } from '@xo/shared';
import { db, hasDatabase } from '@xo/db';
import { getCurrentAccount } from '@/lib/auth';
import { ensureFormationTables, getFormationTemplate } from '@/lib/formations';

export const runtime = 'nodejs';

/** Accès : Admins et + OU Modérateur X (formateurs). */
function canView(grades: string[], grade: string): boolean {
  return getGrade(grade).level >= getGrade('admin').level || grades.includes('modo_x');
}
function canEditTemplate(grade: string): boolean {
  return getGrade(grade).level >= getGrade('responsable').level;
}

export async function GET() {
  if (!hasDatabase()) return NextResponse.json({ error: 'db' }, { status: 503 });
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: 'auth' }, { status: 401 });
  if (!canView(account.site_grades || [], account.site_grade)) {
    return NextResponse.json({ error: 'Réservé aux Admins et Modérateur X.' }, { status: 403 });
  }
  await ensureFormationTables();
  const active = await db()`select * from formations where archived = false order by started_at desc`;
  const archived = await db()`select * from formations where archived = true order by ended_at desc nulls last limit 50`;
  return NextResponse.json({
    active, archived, template: await getFormationTemplate(),
    canEditTemplate: canEditTemplate(account.site_grade),
  });
}

export async function POST(req: Request) {
  if (!hasDatabase()) return NextResponse.json({ error: 'db' }, { status: 503 });
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: 'auth' }, { status: 401 });
  const grades = account.site_grades || [];
  if (!canView(grades, account.site_grade)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  await ensureFormationTables();
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === 'toggle') {
    const id = Number(body.id);
    const key = String(body.item);
    const done = !!body.done;
    await db()`update formations set checks = jsonb_set(checks, ${['{' + key + '}']}::text[], ${JSON.stringify(done)}::jsonb, true) where id = ${id}`;
    return NextResponse.json({ ok: true });
  }
  if (action === 'archive') {
    await db()`update formations set archived = true, ended_at = now() where id = ${Number(body.id)}`;
    return NextResponse.json({ ok: true });
  }
  if (action === 'validate') {
    await db()`update formations set validated = ${!!body.validated} where id = ${Number(body.id)}`;
    return NextResponse.json({ ok: true });
  }
  if (action === 'create') {
    const pseudo = String(body.pseudo || '').trim();
    if (pseudo.length < 2) return NextResponse.json({ error: 'Pseudo requis.' }, { status: 400 });
    const existing = await db()`select id from formations where lower(pseudo) = lower(${pseudo}) and archived = false limit 1`;
    if (existing.length) return NextResponse.json({ ok: true, already: true });
    await db()`insert into formations (pseudo) values (${pseudo})`;
    return NextResponse.json({ ok: true });
  }
  if (action === 'template') {
    if (!canEditTemplate(account.site_grade)) return NextResponse.json({ error: 'Réservé aux Responsables et +.' }, { status: 403 });
    const tpl = body.template;
    if (!tpl || !Array.isArray(tpl.items)) return NextResponse.json({ error: 'Modèle invalide.' }, { status: 400 });
    const json = JSON.stringify(tpl);
    await db()`insert into app_config (k, v) values ('formation_modo_test', ${json})
      on conflict (k) do update set v = ${json}`;
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: 'action' }, { status: 400 });
}
