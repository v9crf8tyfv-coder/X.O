import { NextResponse } from 'next/server';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';
import { deleteRecord } from '@/lib/staff';
import { igSurveil } from '@/lib/igSurveil';

export const runtime = 'nodejs';

/** Supprimer un warn/blame/note — admin+ */
export async function DELETE(_req: Request, { params }: { params: { recordId: string } }) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  await deleteRecord(params.recordId);
  await igSurveil(g.account.minecraft_pseudo ?? g.account.username, 'Panel : note de dossier staff supprimée', 'note #' + params.recordId);
  return NextResponse.json({ ok: true });
}
