import { NextResponse } from 'next/server';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { listAllAccounts } from '@/lib/accounts';

export const runtime = 'nodejs';

/** Liste TOUS les comptes du site (joueurs compris) — fondateurs uniquement */
export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  return NextResponse.json(await listAllAccounts());
}
