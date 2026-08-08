-- ============================================================
--  X.O PANEL — Schéma de base de données (PostgreSQL / Supabase)
--  À exécuter dans Supabase → SQL Editor.
--  Partagé par le bot Discord ET le site.
-- ============================================================

-- ---------- Extensions ----------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================
--  COMPTES DU SITE (authentification pseudo + mot de passe)
-- ============================================================
create table if not exists accounts (
  id              uuid primary key default gen_random_uuid(),
  username        text not null unique,              -- pseudo de connexion au SITE
  password_hash   text not null,                     -- hash bcrypt/argon2 — jamais en clair
  minecraft_pseudo text,                             -- pseudo Minecraft (obligatoire à l'inscription) — lien vers l'IG
  -- Grade d'ACCÈS AU SITE (attribué via "Gestion Site" par les fonda).
  -- 'joueur' par défaut = aucun accès au panel.
  site_grade      text not null default 'joueur',
  is_founder_chief boolean not null default false,   -- la couronne "fonda chef" (1 seul)
  avatar_url      text,                              -- photo de profil (Supabase Storage)
  -- liens optionnels vers les autres identités
  linked_staff_id uuid,                              -- -> staff.id si ce compte est un staff
  created_at      timestamptz not null default now(),
  last_login_at   timestamptz
);

-- ============================================================
--  STAFFS (la "liste des staffs" synchronisée avec Discord)
-- ============================================================
create table if not exists staff (
  id              uuid primary key default gen_random_uuid(),
  pseudo          text not null,                     -- pseudo (Minecraft / affichage)
  discord_tag     text not null,                     -- @tag Discord (pas l'ID)
  discord_id      text,                              -- résolu par le bot depuis le tag
  primary_grade   text not null,                     -- grade principal (clé de GRADES)
  is_absent       boolean not null default false,    -- passe "en absence" dans la liste
  join_count      integer not null default 1,        -- nombre de fois venu dans le staff
  active          boolean not null default true,     -- false = retiré du staff
  created_at      timestamptz not null default now(),
  removed_at      timestamptz
);

-- Grades additionnels d'un staff (un staff peut cumuler plusieurs grades)
create table if not exists staff_grades (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  grade_key  text not null,                          -- clé de ALL_GRADES
  added_by   text,                                   -- qui a ajouté ce grade
  added_at   timestamptz not null default now(),
  unique (staff_id, grade_key)
);

-- Dossier d'un staff : warns, blames, notes...
create table if not exists staff_records (
  id         uuid primary key default gen_random_uuid(),
  staff_id   uuid not null references staff(id) on delete cascade,
  type       text not null check (type in ('warn','blame','note','promotion','retrogradation')),
  reason     text,
  issued_by  text,                                   -- pseudo/tag de l'émetteur
  created_at timestamptz not null default now()
);

-- ============================================================
--  SANCTIONS (joueurs) — remplies par les modo/admin (IG + Discord)
-- ============================================================
create table if not exists sanctions (
  id            uuid primary key default gen_random_uuid(),
  target_pseudo text not null,                       -- joueur sanctionné
  type          text not null check (type in ('ban','kick','mute','warn','tempban','tempmute')),
  reason        text,
  duration      text,                                -- ex "7d", null = permanent
  source        text not null default 'discord' check (source in ('discord','ig','site')),
  issued_by     text not null,                       -- qui a sanctionné
  active        boolean not null default true,
  cancelled_by  text,                                -- qui a annulé
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now()
);

-- ============================================================
--  ABSENCES (système d'absence du bot)
-- ============================================================
create table if not exists absences (
  id           uuid primary key default gen_random_uuid(),
  staff_id     uuid references staff(id) on delete set null,
  discord_id   text not null,
  discord_tag  text,
  reason       text,
  start_date   date,
  end_date     date,
  status       text not null default 'active' check (status in ('active','finished')),
  message_id   text,                                 -- message dans le salon absences
  archive_message_id text,                           -- message dans archives absence
  created_at   timestamptz not null default now(),
  finished_at  timestamptz
);

-- ============================================================
--  TICKETS
-- ============================================================
create table if not exists tickets (
  id             uuid primary key default gen_random_uuid(),
  channel_id     text not null unique,               -- salon du ticket
  category_id    text not null,                      -- id de la catégorie (voir config.ts)
  space          text not null check (space in ('staff','normal')),
  opener_id      text not null,                      -- discord id du créateur
  opener_tag     text not null,
  status         text not null default 'open' check (status in ('open','closed')),
  created_at     timestamptz not null default now(),
  closed_by      text,
  closed_at      timestamptz
);

-- ============================================================
--  SURVEILLANCE — journal de TOUTES les actions
--  (Discord, site, IG futur). Sauf actions des fonda.
-- ============================================================
create table if not exists surveillance_logs (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in ('respo','admin','staff')),
  action     text not null,                          -- ex "role.add", "sanction.create"
  actor      text,                                   -- qui a fait l'action
  target     text,                                   -- sur qui / quoi
  source     text not null default 'discord' check (source in ('discord','site','ig')),
  details    jsonb,                                  -- payload libre
  message_id text,                                   -- message d'embed posté dans le salon
  created_at timestamptz not null default now()
);

-- ============================================================
--  CONFIG /panel — rôles attribués automatiquement à l'arrivée
-- ============================================================
create table if not exists panel_auto_roles (
  id         uuid primary key default gen_random_uuid(),
  role_id    text not null unique,                   -- rôle Discord donné au join
  label      text,
  created_by text,
  created_at timestamptz not null default now()
);

-- ---------- Index utiles ----------
create index if not exists idx_staff_active on staff(active);
create index if not exists idx_staff_grades_staff on staff_grades(staff_id);
create index if not exists idx_records_staff on staff_records(staff_id);
create index if not exists idx_sanctions_target on sanctions(target_pseudo);
create index if not exists idx_absences_status on absences(status);
create index if not exists idx_surv_category on surveillance_logs(category, created_at desc);
