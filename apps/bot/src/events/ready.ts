import { ActivityType, type Client } from 'discord.js';

export function onReady(client: Client): void {
  console.log(`✅ X.O connecté en tant que ${client.user?.tag}`);
  client.user?.setActivity('le staff 👀', { type: ActivityType.Watching });
}
