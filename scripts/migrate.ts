import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL manquant');
    process.exit(1);
  }
  const sql = postgres(url, { ssl: 'require', max: 1 });
  try {
    await sql`alter table accounts add column if not exists minecraft_pseudo text`;
    console.log('✅ Colonne minecraft_pseudo ajoutée (ou déjà présente).');
  } catch (err) {
    console.error('❌ Migration échouée:', err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
