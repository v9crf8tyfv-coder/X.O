import { NextResponse } from 'next/server';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { findById } from '@/lib/accounts';
import { db } from '@xo/db';

export const runtime = 'nodejs';

// Code de transfert du fondateur principal (modifiable via .env)
const TRANSFER_CODE = process.env.CHIEF_TRANSFER_CODE ?? '5688';

/**
 * Transfère le statut de "fondateur principal" (le point jaune) à un autre
 * fondateur. Réservé au chef actuel + code de confirmation. Un seul chef à la fois.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;

  if (!g.account.is_founder_chief) {
    return NextResponse.json(
      { error: 'Seul le fondateur principal peut transférer ce rôle.' },
      { status: 403 },
    );
  }

  const { code } = await req.json().catch(() => ({}));
  if (String(code) !== TRANSFER_CODE) {
    return NextResponse.json({ error: 'Code incorrect.' }, { status: 403 });
  }

  const target = await findById(params.id);
  if (!target) {
    return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
  }
  if (target.id === g.account.id) {
    return NextResponse.json({ error: 'Tu es déjà le fondateur principal.' }, { status: 400 });
  }
  if (!target.site_grades.includes('fondateur')) {
    return NextResponse.json(
      { error: 'La cible doit d’abord être Fondateur.' },
      { status: 400 },
    );
  }

  // Transfert atomique : un seul chef à la fois
  await db().begin(async (sql) => {
    await sql`update accounts set is_founder_chief = false where id = ${g.account.id}`;
    await sql`update accounts set is_founder_chief = true where id = ${target.id}`;
  });

  return NextResponse.json({ ok: true });
}
