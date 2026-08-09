import { NextResponse } from 'next/server';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { listAutoRoles, addAutoRole, removeAutoRole } from '@/lib/serveurs';

export const runtime = 'nodejs';

/** Rôles auto — fondateurs uniquement (Gestion Serveurs) */
export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  return NextResponse.json(await listAutoRoles());
}

export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const { roleId, label } = await req.json().catch(() => ({}));
  if (!roleId || !/^\d{5,25}$/.test(String(roleId))) {
    return NextResponse.json({ error: 'ID de rôle Discord invalide.' }, { status: 400 });
  }
  await addAutoRole(String(roleId), String(label ?? ''), g.account.username);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const roleId = new URL(req.url).searchParams.get('roleId');
  if (!roleId) return NextResponse.json({ error: 'roleId requis.' }, { status: 400 });
  await removeAutoRole(roleId);
  return NextResponse.json({ ok: true });
}
