import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Client, GatewayIntentBits, EmbedBuilder, type TextChannel } from 'discord.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const CHANNEL_ID = '1535421887121985566'; // archives ticket

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once('clientReady', async () => {
    console.log(`✅ Connecté en tant que ${client.user?.tag}`);
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) {
        console.log('❌ Salon INTROUVABLE (mauvais ID ou bot pas dans le serveur).');
      } else {
        console.log(`ℹ️  Salon trouvé : type=${channel.type}, textBased=${channel.isTextBased()}`);
        if (channel.isTextBased()) {
          await (channel as TextChannel).send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('✅ Test archivage')
                .setDescription('Le bot PEUT écrire dans ce salon. (message de test)'),
            ],
          });
          console.log('✅✅ ENVOI RÉUSSI — le bot a bien accès au salon archives.');
        } else {
          console.log('❌ Ce salon n\'est pas un salon TEXTUEL.');
        }
      }
    } catch (err) {
      console.log('❌ ERREUR à l\'envoi :', (err as Error).message);
      console.log('   (code:', (err as { code?: unknown }).code, ')');
    } finally {
      await client.destroy();
      process.exit(0);
    }
  });

  await client.login(process.env.DISCORD_TOKEN);
}

main();
