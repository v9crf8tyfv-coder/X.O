import { NextResponse } from 'next/server';
import { db } from '@xo/db';
import { requireLevel, FOUNDER_LEVEL, ADMIN_LEVEL } from '@/lib/guard';

export const runtime = 'nodejs';

interface Row {
  id: number;
  channel_id: string;
  content: string;
  image_url: string | null;
  mode: string;
  every_hours: number | null;
  at_hhmm: string | null;
  days: string | null;
  enabled: boolean;
  last_sent_at: string | null;
  prefix_color: string | null;
}

const DEFAULT_PREFIX_COLOR = '#FFAA00'; // or (gold), couleur historique du [EmeriaMC]

/** Couleur de préfixe valide (#RRGGBB) ou la couleur par défaut. */
function cleanColor(v: unknown): string {
  const c = String(v ?? '').trim();
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : DEFAULT_PREFIX_COLOR;
}

/** Ajoute la colonne prefix_color si absente (couleur du [EmeriaMC] PAR message). */
async function ensurePrefixColumn(): Promise<void> {
  await db()`alter table auto_messages add column if not exists prefix_color text`.catch(() => {});
}

async function prefixColor(): Promise<string> {
  try {
    // La table app_config est PARTAGÉE avec colonnes (k, v) — ne PAS utiliser key/value.
    await db()`create table if not exists app_config (k text primary key, v text)`.catch(() => {});
    const r = await db()<{ v: string }[]>`select v from app_config where k = 'automsg_prefix_color' limit 1`;
    const val = r[0]?.v;
    return val && /^#[0-9a-fA-F]{6}$/.test(val) ? val : DEFAULT_PREFIX_COLOR;
  } catch { return DEFAULT_PREFIX_COLOR; }
}

export async function GET(req: Request) {
  // Lecture PUBLIQUE pour le mod du serveur : messages "en jeu" (sans salon Discord).
  // Pas de données sensibles (ces messages sont diffusés à tous en jeu de toute façon).
  const url = new URL(req.url);
  await ensurePrefixColumn();
  if (url.searchParams.get('for') === 'game') {
    const rows = await db()<Row[]>`
      select id, content, mode, every_hours, at_hhmm, days, prefix_color
      from auto_messages
      where enabled = true and (channel_id is null or channel_id = '')
      order by id`;
    const res = NextResponse.json({ messages: rows, prefixColor: await prefixColor() });
    res.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res;
  }

  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  const rows = await db()<Row[]>`
    select id, channel_id, content, image_url, mode, every_hours, at_hhmm, days, enabled, last_sent_at, prefix_color
    from auto_messages order by created_at desc`;
  return NextResponse.json({ messages: rows, prefixColor: await prefixColor() });
}

/** Régler la couleur du préfixe [EmeriaMC] (fonda). */
export async function PUT(req: Request) {
  const g = await requireLevel(ADMIN_LEVEL); // même accès que la section messages auto
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  const c = String(b.prefixColor ?? '').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(c)) return NextResponse.json({ error: 'Couleur invalide (format #RRGGBB).' }, { status: 400 });
  // Table PARTAGÉE app_config (colonnes k, v) — cohérent avec site-bg / formations.
  await db()`create table if not exists app_config (k text primary key, v text)`.catch(() => {});
  await db()`insert into app_config (k, v) values ('automsg_prefix_color', ${c})
             on conflict (k) do update set v = ${c}`;
  return NextResponse.json({ ok: true, prefixColor: c });
}

export async function POST(req: Request) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;

  const b = await req.json().catch(() => ({}));
  const target = b.target === 'discord' ? 'discord' : 'game'; // défaut : en jeu
  const channelId = target === 'discord' ? String(b.channelId || '').trim() : '';
  const content = String(b.content || '').trim();
  // Image autorisée partout ; elle ne s'affiche qu'en Discord (le chat en jeu est textuel).
  const imageUrl = String(b.imageUrl || '').trim() || null;
  const mode = b.mode === 'daily' ? 'daily' : 'interval';
  const everyHours = mode === 'interval' ? Math.max(1, Math.min(168, Number(b.everyHours) || 2)) : null;
  const atHHMM = mode === 'daily' ? String(b.atHHMM || '').trim() : null;
  // Jours de la semaine (1=Lun … 7=Dim). Vide ou 7 jours = tous les jours (null).
  let days: string | null = null;
  if (mode === 'daily' && Array.isArray(b.days)) {
    const set = [...new Set(b.days.map((n: unknown) => Number(n)).filter((n: number) => n >= 1 && n <= 7))].sort();
    if (set.length > 0 && set.length < 7) days = set.join(',');
  }

  if (target === 'discord' && !/^\d{5,25}$/.test(channelId)) {
    return NextResponse.json({ error: 'ID de salon invalide (copie l’identifiant du salon Discord).' }, { status: 400 });
  }
  if (!content && !imageUrl) {
    return NextResponse.json({ error: 'Mets au moins un texte (ou une image).' }, { status: 400 });
  }
  if (mode === 'daily' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(atHHMM || '')) {
    return NextResponse.json({ error: 'Heure invalide (format HH:MM, ex. 19:00).' }, { status: 400 });
  }
  if (imageUrl && !/^https?:\/\//.test(imageUrl)) {
    return NextResponse.json({ error: 'Le lien image doit commencer par http(s)://' }, { status: 400 });
  }

  const color = cleanColor(b.prefixColor);
  await ensurePrefixColumn();
  await db()`
    insert into auto_messages (channel_id, content, image_url, mode, every_hours, at_hhmm, days, prefix_color)
    values (${channelId}, ${content}, ${imageUrl}, ${mode}, ${everyHours}, ${atHHMM}, ${days}, ${color})`;
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  const b = await req.json().catch(() => ({}));
  const id = Number(b.id);
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });

  // Sans `edit` : simple bascule actif/pause (comportement historique).
  if (!b.edit) {
    await db()`update auto_messages set enabled = ${!!b.enabled} where id = ${id}`;
    return NextResponse.json({ ok: true });
  }

  // Édition complète du message (mêmes règles que la création).
  const target = b.target === 'discord' ? 'discord' : 'game';
  const channelId = target === 'discord' ? String(b.channelId || '').trim() : '';
  const content = String(b.content || '').trim();
  const imageUrl = String(b.imageUrl || '').trim() || null;
  const mode = b.mode === 'daily' ? 'daily' : 'interval';
  const everyHours = mode === 'interval' ? Math.max(1, Math.min(168, Number(b.everyHours) || 2)) : null;
  const atHHMM = mode === 'daily' ? String(b.atHHMM || '').trim() : null;
  let days: string | null = null;
  if (mode === 'daily' && Array.isArray(b.days)) {
    const set = [...new Set(b.days.map((n: unknown) => Number(n)).filter((n: number) => n >= 1 && n <= 7))].sort();
    if (set.length > 0 && set.length < 7) days = set.join(',');
  }
  if (target === 'discord' && !/^\d{5,25}$/.test(channelId)) {
    return NextResponse.json({ error: 'ID de salon invalide.' }, { status: 400 });
  }
  if (!content && !imageUrl) {
    return NextResponse.json({ error: 'Mets au moins un texte (ou une image).' }, { status: 400 });
  }
  if (mode === 'daily' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(atHHMM || '')) {
    return NextResponse.json({ error: 'Heure invalide (format HH:MM, ex. 19:00).' }, { status: 400 });
  }
  if (imageUrl && !/^https?:\/\//.test(imageUrl)) {
    return NextResponse.json({ error: 'Le lien image doit commencer par http(s)://' }, { status: 400 });
  }

  const color = cleanColor(b.prefixColor);
  await ensurePrefixColumn();
  await db()`
    update auto_messages set
      channel_id = ${channelId}, content = ${content}, image_url = ${imageUrl},
      mode = ${mode}, every_hours = ${everyHours}, at_hhmm = ${atHHMM}, days = ${days},
      prefix_color = ${color}
    where id = ${id}`;
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const g = await requireLevel(ADMIN_LEVEL);
  if (g instanceof NextResponse) return g;
  const id = Number(new URL(req.url).searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'id manquant' }, { status: 400 });
  await db()`delete from auto_messages where id = ${id}`;
  return NextResponse.json({ ok: true });
}
