import { NextResponse } from 'next/server';
import { db, hasDatabase } from '@xo/db';
import { pingDb } from '@/lib/luckpermsSync';
import { rconCommand } from '@/lib/rcon';
import { ftpConfigured, listDatapacks, pingServer } from '@/lib/omgserv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnostic de connectivité (temporaire). Ouvre /api/health : il teste chaque brique
 * (Postgres panel, MySQL LuckPerms, RCON, FTP, ping serveur) et donne l'IP SORTANTE à autoriser.
 * Un vert = OK, un rouge = bloqué (souvent : l'IP de Render n'est pas dans l'allowlist).
 */
async function outboundIp(): Promise<string> {
  try {
    const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    const j = (await r.json()) as { ip?: string };
    return j.ip || '?';
  } catch {
    return '? (sortie internet bloquée)';
  }
}

async function check(fn: () => Promise<boolean>): Promise<{ ok: boolean; error?: string }> {
  try {
    return { ok: await fn() };
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    return { ok: false, error: String(err?.code || err?.message || e) };
  }
}

export async function GET() {
  const ip = await outboundIp();

  const postgres = !hasDatabase()
    ? { ok: false, error: 'DATABASE_URL manquant' }
    : await check(async () => {
        await db()`select 1`;
        return true;
      });

  const mysql = await pingDb();

  const rcon = await check(async () => rconCommand('list'));

  const ftp = !ftpConfigured()
    ? { ok: false, error: 'FTP non configuré' }
    : await check(async () => {
        await listDatapacks();
        return true;
      });

  const gamePing = await check(async () => pingServer());

  const allOk = postgres.ok && mysql.ok && rcon.ok && ftp.ok;
  return NextResponse.json(
    {
      allOk,
      outboundIp: ip,
      note: "Si un bloc est 'ok:false', autorise 'outboundIp' dans l'allowlist de ce service "
        + '(OMGserv pour RCON/FTP, l\'hôte MySQL pour la base LuckPerms, le provider Postgres pour la base panel).',
      postgres, // base principale du panel (comptes, staff, items…)
      mysql,    // base LuckPerms (grades en jeu)
      rcon,     // sync grades vers le serveur (lp sync)
      ftp,      // upload des mods / datapacks / items perso
      gamePing, // le serveur Minecraft répond-il ?
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
