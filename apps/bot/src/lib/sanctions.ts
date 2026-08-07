import { db, hasDatabase } from '@xo/db';

/** Enregistre une sanction en base (pour la Gestion Sanctions du site) */
export async function recordSanction(params: {
  targetPseudo: string;
  type: 'ban' | 'kick' | 'mute' | 'warn' | 'tempban' | 'tempmute';
  reason?: string | null;
  duration?: string | null;
  issuedBy: string;
  source?: 'discord' | 'ig' | 'site';
}): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await db()`
      insert into sanctions (target_pseudo, type, reason, duration, issued_by, source)
      values (${params.targetPseudo}, ${params.type}, ${params.reason ?? null},
              ${params.duration ?? null}, ${params.issuedBy}, ${params.source ?? 'discord'})
    `;
  } catch (err) {
    console.error('[sanctions] insertion échouée:', err);
  }
}
