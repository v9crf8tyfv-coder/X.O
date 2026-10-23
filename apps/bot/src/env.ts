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
  // Optionnel : webhook Discord où le bot poste son démarrage + ses erreurs (pour voir les logs).
  LOG_WEBHOOK_URL: process.env.LOG_WEBHOOK_URL ?? '',
  // Optionnel : serveurs Discord Com / RP (dispatching). Le bot doit y être avec « Gérer les rôles ».
  DISCORD_COM_GUILD_ID: process.env.DISCORD_COM_GUILD_ID ?? '',
  DISCORD_RP_GUILD_ID: process.env.DISCORD_RP_GUILD_ID ?? '',
};
