import { NextResponse } from 'next/server';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { listDiscordRoles } from '@/lib/serveurs';

export const runtime = 'nodejs';

/** Liste live des rôles Discord (fondateurs uniquement) — pour l'autorole d'arrivée. */
export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  return NextResponse.json(await listDiscordRoles());
}
