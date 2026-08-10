import postgres from 'postgres';

/**
 * Client Postgres partagé (bot + site).
 * Connexion paresseuse : le bot peut démarrer SANS DATABASE_URL
 * (les fonctionnalités 100% Discord marchent, la DB est optionnelle
 * tant que Supabase n'est pas configuré).
 */

let _sql: ReturnType<typeof postgres> | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function db(): ReturnType<typeof postgres> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL non défini. Configure Supabase dans .env avant d\'utiliser la base.',
    );
  }
  if (!_sql) {
    _sql = postgres(process.env.DATABASE_URL, {
      ssl: 'require',
      max: 3, // peu de connexions (pooler Supabase limité)
      idle_timeout: 15, // libère vite
      connect_timeout: 10,
      prepare: false, // requis pour le pooler "transaction" (port 6543)
    });
  }
  return _sql;
}

export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}
