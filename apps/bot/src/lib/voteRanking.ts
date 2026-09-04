import { db, hasDatabase } from '@xo/db';

export interface VoteRow {
  name: string;
  votes: number;
}

/** Jeton top-serveurs : env prioritaire, sinon app_config (posé par le site). */
async function topServeursToken(): Promise<string | null> {
  if (process.env.TOPSERVEURS_TOKEN) return process.env.TOPSERVEURS_TOKEN;
  if (!hasDatabase()) return null;
  try {
    const r = await db()<{ v: string }[]>`select v from app_config where k = 'topserveurs_token' limit 1`;
    return r[0]?.v ?? null;
  } catch {
    return null;
  }
}

/**
 * Classement des votes du mois en cours, additionné par pseudo (comme le site) :
 * table site_votes (tous les sites via le pont Discord) + API top-serveurs.
 */
export async function getVoteRanking(limit = 7): Promise<VoteRow[]> {
  const map = new Map<string, VoteRow>();
  const add = (rawName: string, votes: number): void => {
    const name = String(rawName);
    const key = name.toLowerCase();
    const cur = map.get(key);
    if (cur) cur.votes += votes;
    else map.set(key, { name, votes });
  };

  if (hasDatabase()) {
    try {
      const rows = await db()<{ pseudo: string; votes: number }[]>`
        select (array_agg(pseudo order by voted_at desc))[1] as pseudo, count(*)::int as votes
        from site_votes
        where voted_at >= date_trunc('month', now()) and site <> 'topserveurs'
        group by lower(pseudo)`;
      for (const r of rows) add(r.pseudo, Number(r.votes));
    } catch {
      /* base indispo : on continue avec top-serveurs */
    }
  }

  const token = await topServeursToken();
  if (token) {
    try {
      const res = await fetch(`https://api.top-serveurs.net/v1/servers/${token}/players-ranking`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const j = (await res.json()) as { players?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
        const list = Array.isArray(j) ? j : Array.isArray(j.players) ? j.players : [];
        for (const p of list) {
          const name = (p.playername ?? p.username ?? p.pseudo ?? p.name) as string | undefined;
          const votes = Number(p.votes ?? p.vote ?? 0);
          if (name && votes > 0) add(name, votes);
        }
      }
    } catch {
      /* API indispo : on garde ce qu'on a */
    }
  }

  return [...map.values()]
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))
    .slice(0, limit);
}
