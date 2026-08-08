import { NextResponse } from 'next/server';
import { ALL_GRADES } from '@xo/shared';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { findById, setAccountGrade, publicAccount } from '@/lib/accounts';

export const runtime = 'nodejs';

/**
 * Change le grade d'ACCÈS SITE d'un compte (ne touche NI Discord NI IG).
 * Fondateurs uniquement. Règle : seul le fondateur principal (chef) peut
 * modifier un compte fondateur (ou nommer quelqu'un fondateur).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;

  const { grade } = await req.json().catch(() => ({}));
  if (grade !== 'joueur' && !ALL_GRADES[grade]) {
    return NextResponse.json({ error: 'Grade invalide.' }, { status: 400 });
  }

  const target = await findById(params.id);
  if (!target) {
    return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
  }

  // Seul le fondateur principal touche aux fondateurs
  const touchesFounder = target.site_grade === 'fondateur' || grade === 'fondateur';
  if (touchesFounder && !g.account.is_founder_chief) {
    return NextResponse.json(
      { error: 'Seul le fondateur principal peut gérer les fondateurs.' },
      { status: 403 },
    );
  }

  await setAccountGrade(params.id, grade);
  const updated = await findById(params.id);
  return NextResponse.json(updated ? publicAccount(updated) : { ok: true });
}
