import { NextResponse } from 'next/server';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';
import { addRecord } from '@/lib/staff';

export const runtime = 'nodejs';

/** Ajouter un warn / blame / note à un staff — admin+ (pas besoin d'être resp) */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;

  const { type, reason } = await req.json().catch(() => ({}));
  if (!['warn', 'blame', 'note'].includes(type)) {
    return NextResponse.json({ error: 'Type invalide.' }, { status: 400 });
  }
  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: 'Motif requis.' }, { status: 400 });
  }

  await addRecord({
    staffId: params.id,
    type,
    reason: reason.trim(),
    issuedBy: g.account.username,
  });
  return NextResponse.json({ ok: true });
}
