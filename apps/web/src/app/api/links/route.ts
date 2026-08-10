import { NextResponse } from 'next/server';
import { getGrade, ALL_GRADES } from '@xo/shared';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';
import { listLinks, addLink, removeLink } from '@/lib/links';

export const runtime = 'nodejs';

/** Liste les liens visibles : ceux destinés à SON grade ou EN DESSOUS */
export async function GET() {
  const g = await requireLevel(1); // tout compte avec un grade (pas joueur)
  if (g instanceof NextResponse) return g;
  const myLevel = getGrade(g.account.site_grade).level;
  const links = await listLinks();
  return NextResponse.json(links.filter((l) => getGrade(l.grade).level <= myLevel));
}

/** Ajouter un lien — fondateurs uniquement */
export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const { title, url, grade } = await req.json().catch(() => ({}));
  if (!title || !url || !grade) {
    return NextResponse.json({ error: 'Titre, lien et grade requis.' }, { status: 400 });
  }
  if (grade !== 'joueur' && !ALL_GRADES[grade]) {
    return NextResponse.json({ error: 'Grade invalide.' }, { status: 400 });
  }
  await addLink(String(title), String(url), String(grade), g.account.username);
  return NextResponse.json({ ok: true });
}

/** Supprimer un lien — fondateurs uniquement */
export async function DELETE(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id requis.' }, { status: 400 });
  await removeLink(id);
  return NextResponse.json({ ok: true });
}
