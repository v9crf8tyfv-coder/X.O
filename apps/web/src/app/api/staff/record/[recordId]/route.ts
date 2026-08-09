import { NextResponse } from 'next/server';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';
import { deleteRecord } from '@/lib/staff';

export const runtime = 'nodejs';

/** Supprimer un warn/blame/note — admin+ */
export async function DELETE(_req: Request, { params }: { params: { recordId: string } }) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  await deleteRecord(params.recordId);
  return NextResponse.json({ ok: true });
}
