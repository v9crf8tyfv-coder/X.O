/**
 * Client RCON minimal (protocole Source RCON), SANS dépendance (net TCP brut).
 *
 * Sert UNIQUEMENT à envoyer `lp sync` au serveur OMGServ après un changement de
 * grade, pour que LuckPerms relise la base TOUT DE SUITE (sinon délai = sync-minutes).
 *
 * Variables d'env (sur Vercel). Si absentes -> no-op (on retombe sur le délai LP) :
 *   RCON_HOST, RCON_PORT (défaut 25575), RCON_PASSWORD
 *   RCON_SYNC_COMMAND (optionnel, défaut "lp sync")
 */
import { Socket } from 'net';

const TYPE_AUTH = 3;
const TYPE_EXEC = 2;

function packet(id: number, type: number, body: string): Buffer {
  const payload = Buffer.from(body, 'utf8');
  const buf = Buffer.alloc(payload.length + 14); // 4 size + 4 id + 4 type + body + 2 null
  buf.writeInt32LE(payload.length + 10, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  payload.copy(buf, 12);
  // 2 octets nuls déjà à 0 (Buffer.alloc)
  return buf;
}

/** Envoie une commande RCON. Résout en silence (ne fait jamais planter l'appelant). */
function sendCommand(host: string, port: number, password: string, command: string): Promise<void> {
  return new Promise((resolve) => {
    const sock = new Socket();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { sock.destroy(); } catch { /* ignore */ }
      resolve();
    };
    sock.setTimeout(4000);
    sock.on('timeout', finish);
    sock.on('error', (e) => { console.warn('[RCON] erreur', e instanceof Error ? e.message : e); finish(); });
    sock.connect(port, host, () => {
      sock.write(packet(1, TYPE_AUTH, password));
    });
    let gotAuth = false;
    sock.on('data', () => {
      if (!gotAuth) {
        gotAuth = true;
        sock.write(packet(2, TYPE_EXEC, command));
        // Laisse un court instant au serveur pour traiter puis on ferme.
        setTimeout(finish, 300);
      }
    });
  });
}

/** Force LuckPerms à relire la base immédiatement (no-op si RCON non configuré). */
export async function luckpermsSyncNow(): Promise<void> {
  const { RCON_HOST, RCON_PASSWORD } = process.env;
  if (!RCON_HOST || !RCON_PASSWORD) return; // non configuré -> délai LP normal
  const port = Number(process.env.RCON_PORT || 25575);
  const cmd = process.env.RCON_SYNC_COMMAND || 'lp sync';
  try {
    await sendCommand(RCON_HOST, port, RCON_PASSWORD, cmd);
    console.log('[RCON] lp sync envoyé (grades appliqués immédiatement)');
  } catch (e) {
    console.warn('[RCON] échec lp sync', e instanceof Error ? e.message : e);
  }
}
