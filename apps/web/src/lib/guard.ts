import { NextResponse } from 'next/server';
import { getGrade, GRADES, ALL_GRADES } from '@xo/shared';
import { getCurrentAccount } from './auth';
import type { Account } from './accounts';

export const ADMIN_LEVEL = GRADES.admin.level;
export const RESP_LEVEL = GRADES.responsable.level;
export const FOUNDER_LEVEL = GRADES.cofondateur.level;

/**
 * Un manager (de niveau `managerLevel`) peut-il attribuer/retirer le grade `g`
 * dans la Gestion Staff ? Règle : strictement en dessous de son niveau, jamais
 * fonda/co-fonda. (=> responsable réservé aux fondateurs, resp ne touche pas resp.)
 */
export function canAssignGrade(g: string, managerLevel: number): boolean {
  if (g === 'fondateur' || g === 'cofondateur') return false;
  if (!ALL_GRADES[g]) return false;
  return getGrade(g).level < managerLevel;
}

/**
 * Garde pour les routes API : vérifie la connexion + le niveau de grade.
 * Retourne { account } si OK, ou une NextResponse d'erreur sinon.
 */
export async function requireLevel(
  minLevel: number,
): Promise<{ account: Account } | NextResponse> {
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }
  const level = getGrade(account.site_grade).level;
  if (level < minLevel) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }
  return { account };
}
