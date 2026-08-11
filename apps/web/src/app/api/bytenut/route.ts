import { NextResponse } from 'next/server';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { getBytenutStatus, resetBytenut } from '@/lib/bytenut';

export const runtime = 'nodejs';

/** Statut du timer Bytenut — fondateurs uniquement. */
export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  return NextResponse.json(await getBytenutStatus());
}

/** Reset / suppression du timer — fondateurs uniquement. */
export async function DELETE() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  await resetBytenut();
  return NextResponse.json({ ok: true });
}
