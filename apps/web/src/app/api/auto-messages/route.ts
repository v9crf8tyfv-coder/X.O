import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { requireLevel, FOUNDER_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

interface Row {
  id: number;
  channel_id: string;
  content: string;
  image_url: string | null;
  mode: string;
  every_hours: number | null;
  at_hhmm: string | null;
  enabled: boolean;
  last_sent_at: string | null;
}

export async function GET() {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const rows = await db()<Row[]>`
    select id, channel_id, content, image_url, mode, every_hours, at_hhmm, enabled, last_sent_at
    from auto_messages order by created_at desc`;
  return NextResponse.json({ messages: rows });
}

export async function POST(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;

  const b = await req.json().catch(() => ({}));
  const channelId = String(b.channelId || '').trim();
  const content = String(b.content || '').trim();
  const imageUrl = String(b.imageUrl || '').trim() || null;
  const mode = b.mode === 'daily' ? 'daily' : 'interval';
  const everyHours = mode === 'interval' ? Math.max(1, Math.min(168, Number(b.everyHours) || 2)) : null;
  const atHHMM = mode === 'daily' ? String(b.atHHMM || '').trim() : null;

  if (!/^\d{5,25}$/.test(channelId)) {
    return NextResponse.json({ error: 'ID de salon invalide (copie l’identifiant du salon Discord).' }, { status: 400 });
  }
  if (!content && !imageUrl) {
    return NextResponse.json({ error: 'Mets au moins un texte ou une image.' }, { status: 400 });
  }
  if (mode === 'daily' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(atHHMM || '')) {
    return NextResponse.json({ error: 'Heure invalide (format HH:MM, ex. 19:00).' }, { status: 400 });
  }
  if (imageUrl && !/^https?:\/\//.test(imageUrl)) {
    return NextResponse.json({ error: 'Le lien image doit commencer par http(s)://' }, { status: 400 });
  }

  await db()`
    insert into auto_messages (channel_id, content, image_url, mode, every_hours, at_hhmm)
    values (${channelId}, ${content}, ${imageUrl}, ${mode}, ${everyHours}, ${atHHMM})`;
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });
  await db()`update auto_messages set enabled = ${!!b.enabled} where id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const g = await requireLevel(FOUNDER_LEVEL);
  if (g instanceof NextResponse) return g;
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });
  await db()`delete from auto_messages where id = ${id}`;
  return NextResponse.json({ ok: true });
}
