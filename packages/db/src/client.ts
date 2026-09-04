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
      max: 8, // assez de connexions pour que le pool ne s'épuise jamais (workers + commandes)
      idle_timeout: 20, // libère les connexions inactives
      max_lifetime: 60 * 5, // recycle chaque connexion toutes les 5 min -> tue les connexions "zombies" du pooler
      connect_timeout: 10,
      prepare: false, // requis pour le pooler "transaction" (port 6543)
      onnotice: () => {}, // supprime le spam "relation already exists"
      // Toute valeur `undefined` devient NULL au lieu de faire planter la requête.
      transform: { undefined: null },
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
