import { NextResponse } from 'next/server';
import { requireRp } from '@/lib/guard';
import { deleteRpRecord } from '@/lib/rp';
import { igSurveil } from '@/lib/igSurveil';

export const runtime = 'nodejs';

/** Supprime un dossier RP */
export async function DELETE(_req: Request, { params }: { params: { recordId: string } }) {
  const g = await requireRp();
  if (g instanceof NextResponse) return g;
  await deleteRpRecord(params.recordId);
  await igSurveil(g.account.minecraft_pseudo ?? g.account.username, 'Panel : note de dossier RP supprimée', 'note #' + params.recordId);
  return NextResponse.json({ ok: true });
}
