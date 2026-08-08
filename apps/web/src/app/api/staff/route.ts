import { NextResponse } from 'next/server';
import { ALL_GRADES } from '@xo/shared';
import { requireLevel, ADMIN_LEVEL } from '@/lib/guard';
import { listStaff, createStaff } from '@/lib/staff';

export const runtime = 'nodejs';

export async function GET() {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  return NextResponse.json(await listStaff());
}

export async function POST(req: Request) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;

  const { pseudo, discordTag, grade } = await req.json().catch(() => ({}));
  if (!pseudo || !discordTag || !grade) {
    return NextResponse.json(
      { error: 'Pseudo, tag Discord et grade sont requis.' },
      { status: 400 },
    );
  }
  if (!ALL_GRADES[grade]) {
    return NextResponse.json({ error: 'Grade invalide.' }, { status: 400 });
  }

  // TODO (sync) : déposer une pending_action pour que le bot applique le rôle Discord
  //               (+ rang IG plus tard) et actualise l'effectif.
  const staff = await createStaff({ pseudo, discordTag, grade });
  return NextResponse.json(staff);
}
