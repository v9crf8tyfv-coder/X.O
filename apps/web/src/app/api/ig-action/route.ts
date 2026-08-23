import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';

export const runtime = 'nodejs';

/**
 * Reçoit une action staff EN JEU depuis le mod EmeriaCore et la stocke.
 * Le bot la relaiera ensuite dans le bon salon de surveillance.
 * Auth : header `x-ig-secret` == env IG_ACTION_SECRET.
 */
export async function POST(req: Request) {
  const secret = req.headers.get('x-ig-secret');
  if (!process.env.IG_ACTION_SECRET || secret !== process.env.IG_ACTION_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ error: 'no database' }, { status: 500 });
  }

  let body: { actor?: string; action?: string; target?: string; details?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }

  const actor = body.actor?.toString().slice(0, 64);
  const action = body.action?.toString().slice(0, 128);
  if (!actor || !action) {
    return NextResponse.json({ error: 'missing actor/action' }, { status: 400 });
  }
  const target = body.target ? body.target.toString().slice(0, 128) : null;
  const details = body.details ? body.details.toString().slice(0, 1000) : null;

  await db()`
    create table if not exists ig_actions (
      id bigserial primary key,
      actor text not null,
      action text not null,
      target text,
      details text,
      created_at timestamptz not null default now(),
      processed boolean not null default false
    )
  `;
  await db()`
    insert into ig_actions (actor, action, target, details)
    values (${actor}, ${action}, ${target}, ${details})
  `;

  return NextResponse.json({ ok: true });
}
