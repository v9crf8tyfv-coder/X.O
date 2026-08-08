import { NextResponse } from 'next/server';
import { ALL_GRADES } from '@xo/shared';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { findById, setAccountGrades, publicAccount } from '@/lib/accounts';

export const runtime = 'nodejs';

/**
 * Définit les rôles d'ACCÈS SITE d'un compte (ne touche NI Discord NI IG).
 * Fondateurs uniquement. Règles :
 *  - seul le fondateur principal (chef) peut ajouter/retirer le rôle Fondateur ;
 *  - on ne peut pas retirer le rôle Fondateur au fondateur principal (anti-lockout).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;

  const body = await req.json().catch(() => ({}));
  const grades: unknown = body.grades;
  if (!Array.isArray(grades) || grades.some((x) => typeof x !== 'string' || !ALL_GRADES[x])) {
    return NextResponse.json({ error: 'Rôles invalides.' }, { status: 400 });
  }
  const next = [...new Set(grades as string[])];

  const target = await findById(params.id);
  if (!target) {
    return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
  }

  const oldHasFounder = target.site_grades.includes('fondateur');
  const newHasFounder = next.includes('fondateur');

  // Seul le chef touche au rôle Fondateur
  if (oldHasFounder !== newHasFounder && !g.account.is_founder_chief) {
    return NextResponse.json(
      { error: 'Seul le fondateur principal peut gérer le rôle Fondateur.' },
      { status: 403 },
    );
  }
  // Anti-lockout : on ne retire pas Fondateur au fondateur principal
  if (target.is_founder_chief && !newHasFounder) {
    return NextResponse.json(
      { error: 'Impossible de retirer le rôle Fondateur au fondateur principal.' },
      { status: 403 },
    );
  }

  await setAccountGrades(params.id, next);
  const updated = await findById(params.id);
  return NextResponse.json(updated ? publicAccount(updated) : { ok: true });
}
