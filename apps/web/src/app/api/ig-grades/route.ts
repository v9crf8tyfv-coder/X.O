import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';

export const runtime = 'nodejs';

/**
 * Pont panel → serveur : le mod EmeriaCore (/staffon) relit les grades FRAIS d'un joueur
 * depuis sa carte staff. Renvoie les clés de grade = noms de groupes LuckPerms à appliquer.
 * Auth : header x-ig-secret == env IG_ACTION_SECRET (comme les autres /api/ig-*).
 */
function auth(req: Request): boolean {
  const secret = req.headers.get('x-ig-secret');
  return !!process.env.IG_ACTION_SECRET && secret === process.env.IG_ACTION_SECRET;
}

export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ grades: [] });
  const pseudo = (new URL(req.url).searchParams.get('pseudo') || '').trim();
  if (!pseudo) return NextResponse.json({ error: 'pseudo manquant' }, { status: 400 });
  const rows = await db()<{ grades: string[] }[]>`
    select grades from staff where active = true and lower(pseudo) = lower(${pseudo}) limit 1
  `.catch(() => [] as never[]);
  // staff = carte active ; grades = clés de grade. staff absent -> [] (plus staff = pas de grade remis).
  const grades = Array.isArray(rows[0]?.grades) ? rows[0]!.grades : [];
  return NextResponse.json({ pseudo, grades });
}
