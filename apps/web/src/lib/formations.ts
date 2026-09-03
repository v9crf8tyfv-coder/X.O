import { db, hasDatabase } from '@xo/db';

/** Modèle de formation par défaut (Modérateur Test) — éditable via le panel. */
export const DEFAULT_TEMPLATE = {
  title: 'Modérateur Test — Compétences',
  intro: 'Durée maximale : 4 semaines. Le formateur coche chaque point une fois validé.',
  items: [
    { id: '1', label: 'Gestion du chat', section: true },
    { id: '1.1', label: 'Connaissance des sanctions (mute, warn, jail…)' },
    { id: '1.2', label: 'Entraînement chat : 5 périodes de 10 exemples (max 3 fautes/période)' },
    { id: '1.3', label: 'Tableau des sanctions : au minimum 50 %' },
    { id: '1.4', label: 'Gestion du chat seul pendant 30 minutes (1 faute = échec)' },
    { id: '2', label: 'Savoir répondre aux joueurs — Wiki', section: true },
    { id: '2.1', label: 'Questions Wiki : minimum 60 % de bonnes réponses' },
    { id: '3', label: 'Questions de connaissance du Staff', section: true },
    { id: '3.1', label: 'Durée maximale d’un mute applicable' },
    { id: '3.2', label: 'Durée maximale d’un jail applicable' },
    { id: '3.3', label: 'Sanction chat dépassant la limite : que fais-tu ?' },
    { id: '3.4', label: 'Lancer une routine et à quoi elle sert' },
    { id: '3.5', label: 'Un joueur signale un bug : que fais-tu ?' },
  ],
};
export type FormationTemplate = typeof DEFAULT_TEMPLATE;

export async function ensureFormationTables(): Promise<void> {
  await db()`create table if not exists formations (
    id bigserial primary key,
    pseudo text not null,
    uuid text,
    started_at timestamptz not null default now(),
    ended_at timestamptz,
    archived boolean not null default false,
    checks jsonb not null default '{}'::jsonb,
    validated boolean not null default false
  )`.catch(() => {});
  // app_config existe déjà (colonnes k/v en text) — on réutilise ce schéma.
  await db()`create table if not exists app_config (k text primary key, v text)`.catch(() => {});
}

export async function getFormationTemplate(): Promise<FormationTemplate> {
  const r = await db()<{ v: string }[]>`select v from app_config where k = 'formation_modo_test'`;
  if (r[0]?.v) { try { return JSON.parse(r[0].v) as FormationTemplate; } catch { /* défaut */ } }
  return DEFAULT_TEMPLATE;
}

/** Crée une formation si le pseudo est (ou devient) Modérateur Test. Non bloquant. */
export async function ensureFormationFor(grades: string[], pseudo: string): Promise<void> {
  if (!hasDatabase() || !pseudo || !grades.includes('modo_test')) return;
  try {
    await ensureFormationTables();
    const existing = await db()`select id from formations where lower(pseudo) = lower(${pseudo}) and archived = false limit 1`;
    if (!existing.length) await db()`insert into formations (pseudo) values (${pseudo})`;
  } catch {
    /* non bloquant */
  }
}
