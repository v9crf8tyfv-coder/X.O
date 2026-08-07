import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('❌ DATABASE_URL manquant dans .env');
    process.exit(1);
  }

  const schema = readFileSync(resolve(__dirname, '../packages/db/schema.sql'), 'utf8');
  const sql = postgres(url, { ssl: 'require', max: 1 });

  try {
    console.log('⏳ Création des tables…');
    await sql.unsafe(schema);
    console.log('✅ Schéma appliqué avec succès.');
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name
    `;
    console.log('📋 Tables :', tables.map((t) => t.table_name).join(', '));
  } catch (err) {
    console.error('❌ Erreur lors de l\'application du schéma:', err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
