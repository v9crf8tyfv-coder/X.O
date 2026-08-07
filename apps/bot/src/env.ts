import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Charge le .env depuis la racine du monorepo (../../.. depuis apps/bot/src)
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env') });
config(); // et un éventuel .env local au dossier bot

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`❌ Variable d'environnement manquante : ${name}`);
    process.exit(1);
  }
  return v;
}

export const ENV = {
  DISCORD_TOKEN: required('DISCORD_TOKEN'),
  DISCORD_CLIENT_ID: required('DISCORD_CLIENT_ID'),
  DISCORD_GUILD_ID: required('DISCORD_GUILD_ID'),
};
