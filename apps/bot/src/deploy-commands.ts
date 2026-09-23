import { deployCommands } from './lib/deployCommands.js';

/** Script manuel : `npm run bot:deploy`. (Le bot déploie aussi les commandes au démarrage.) */
deployCommands().then((ok) => {
  if (!ok) process.exit(1);
});
