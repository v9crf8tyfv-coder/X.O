import { queryFull } from 'minecraft-server-util';
import { db, hasDatabase } from '@xo/db';

const HOST = 'emeriamc.mine.gg';
const PORT = 10006;
const EVERY_MS = 60_000; // 1 min -> +1 min de jeu par staff en ligne (précision ~1 min)

/** Date du jour au format YYYY-MM-DD, fuseau Europe/Paris. */
function parisDay(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

async function ensureTable(): Promise<void> {
  await db()`
    create table if not exists playtime (
      pseudo text not null,
      day date not null,
      minutes integer not null default 0,
      primary key (pseudo, day)
    )
  `;
}

// Cache nom(minuscule) -> UUID Mojang (sans tirets). Évite de spammer l'API Mojang.
const uuidCache = new Map<string, string>();

async function resolveUuid(name: string): Promise<string | null> {
  const key = name.toLowerCase();
  if (uuidCache.has(key)) return uuidCache.get(key)!;
  try {
    const r = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const j = (await r.json()) as { id?: string };
      if (j.id) {
        uuidCache.set(key, j.id);
        return j.id;
      }
    }
  } catch {
    /* Mojang injoignable -> on renverra null */
  }
  return null;
}

/** Renomme un joueur partout (staff/compte + temps de jeu) suite à un changement de pseudo MC. */
async function healRename(kind: 'staff' | 'acc', uuid: string, oldPseudo: string, newName: string): Promise<void> {
  if (kind === 'staff') {
    await db()`update staff set pseudo = ${newName} where minecraft_uuid = ${uuid}`;
  } else {
    await db()`update accounts set minecraft_pseudo = ${newName} where minecraft_uuid = ${uuid}`;
  }
  // Fusionne le temps de jeu de l'ancien pseudo dans le nouveau
  await db()`
    insert into playtime (pseudo, day, minutes)
    select ${newName}, day, minutes from playtime where lower(pseudo) = lower(${oldPseudo})
    on conflict (pseudo, day) do update set minutes = playtime.minutes + excluded.minutes
  `;
  await db()`delete from playtime where lower(pseudo) = lower(${oldPseudo}) and lower(pseudo) <> lower(${newName})`;
  console.log(`[playtime] rename auto-corrigé : ${oldPseudo} -> ${newName} (${uuid})`);
}

async function tick(): Promise<void> {
  if (!hasDatabase()) return;

  // Qui est en ligne ? (liste complète, pas un échantillon)
  let online: string[] = [];
  try {
    const res = await queryFull(HOST, PORT, { timeout: 5000 });
    online = res.players?.list ?? [];
  } catch {
    return; // serveur hors ligne -> on ne compte rien
  }
  if (online.length === 0) return;

  // Staff actif + fondateurs (avec leur UUID quand connu)
  const staff = await db()<{ pseudo: string; minecraft_uuid: string | null }[]>`
    select pseudo, minecraft_uuid from staff where active = true
  `;
  const founders = await db()<{ minecraft_pseudo: string; minecraft_uuid: string | null }[]>`
    select minecraft_pseudo, minecraft_uuid from accounts
    where site_grade in ('fondateur', 'cofondateur') and minecraft_pseudo is not null
  `;

  // Index par UUID (rename-proof) + secours par nom (si UUID inconnu)
  const byUuid = new Map<string, { kind: 'staff' | 'acc'; pseudo: string }>();
  const byName = new Set<string>();
  for (const s of staff) {
    if (s.minecraft_uuid) byUuid.set(s.minecraft_uuid, { kind: 'staff', pseudo: s.pseudo });
    else byName.add(s.pseudo.toLowerCase());
  }
  for (const f of founders) {
    if (f.minecraft_uuid) byUuid.set(f.minecraft_uuid, { kind: 'acc', pseudo: f.minecraft_pseudo });
    else byName.add(f.minecraft_pseudo.toLowerCase());
  }

  const day = parisDay();
  for (const name of online) {
    const lower = name.toLowerCase();
    const uuid = await resolveUuid(name);

    let storedPseudo = name;

    // Staff/founder : suivi par UUID (rename-proof, met à jour le pseudo partout)
    if (uuid && byUuid.has(uuid)) {
      const e = byUuid.get(uuid)!;
      storedPseudo = e.pseudo;
      if (e.pseudo.toLowerCase() !== lower) {
        await healRename(e.kind, uuid, e.pseudo, name);
        storedPseudo = name;
      }
    }

    // Suivi de TOUS les joueurs (par pseudo) — nécessaire pour la boutique (temps de jeu total).
    // Écritures en base uniquement -> impact RAM négligeable.
    await db()`
      insert into playtime (pseudo, day, minutes) values (${storedPseudo}, ${day}, 1)
      on conflict (pseudo, day) do update set minutes = playtime.minutes + 1
    `;
  }
}

/** Cumule le temps de jeu (minutes/jour) de chaque staff en ligne. Suivi par UUID (rename-proof). */
export function startPlaytimeTracker(): void {
  if (!hasDatabase()) {
    console.log('[playtime] pas de base → désactivé');
    return;
  }
  ensureTable().catch((e) => console.error('[playtime] table', e));
  console.log('[playtime] traqueur démarré (1 min, suivi par UUID)');
  setInterval(() => {
    tick().catch((e) => console.error('[playtime]', e));
  }, EVERY_MS);
}
