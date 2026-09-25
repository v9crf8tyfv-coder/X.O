import { NextResponse } from 'next/server';
import { requireRp } from '@/lib/guard';
import { addRpRecord } from '@/lib/rp';

export const runtime = 'nodejs';

/** Ajoute un dossier RP (warn/blame/note) à un membre */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireRp();
  if (g instanceof NextResponse) return g;
  const { type, reason } = await req.json().catch(() => ({}));
  if (!['warn', 'blame', 'note'].includes(type)) {
    return NextResponse.json({ error: 'Type invalide.' }, { status: 400 });
  }
  if (!reason || typeof reason !== 'string') {
    return NextResponse.json({ error: 'Raison requise.' }, { status: 400 });
  }
  await addRpRecord({ memberId: params.id, type, reason, issuedBy: g.account.username });
  return NextResponse.json({ ok: true });
}
