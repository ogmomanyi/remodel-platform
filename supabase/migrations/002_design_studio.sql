-- Kota Designs: database foundation for editable renovation projects.
-- Run in Supabase SQL Editor after the existing project_approvals setup.

create extension if not exists pgcrypto;

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique,
  slug text not null unique,
  client_name text not null,
  property_name text,
  property_address text,
  description text,
  status text not null default 'draft' check (status in ('draft','design','proposal','sent','approved','in_progress','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_members (
  project_id uuid not null references projects(id) on delete cascade,
  email text not null,
  role text not null default 'client' check (role in ('client','internal','consultant')),
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);

create table if not exists project_spaces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  space_type text not null default 'other',
  measurements jsonb not null default '{}'::jsonb,
  existing_notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists design_options (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references project_spaces(id) on delete cascade,
  name text not null,
  description text,
  materials jsonb not null default '[]'::jsonb,
  cost_estimate numeric(14,2),
  currency text not null default 'KES',
  status text not null default 'draft' check (status in ('draft','proposed','selected','rejected')),
  is_recommended boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  space_id uuid references project_spaces(id) on delete set null,
  design_option_id uuid references design_options(id) on delete set null,
  kind text not null check (kind in ('site_photo','plan','render','moodboard','material','progress','document')),
  storage_path text not null,
  alt_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  event_type text not null,
  actor_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_spaces_project_id_idx on project_spaces(project_id, sort_order);
create index if not exists design_options_space_id_idx on design_options(space_id, sort_order);
create index if not exists project_assets_project_id_idx on project_assets(project_id, created_at desc);
create index if not exists project_events_project_id_idx on project_events(project_id, created_at desc);

alter table projects enable row level security;
alter table project_members enable row level security;
alter table project_spaces enable row level security;
alter table design_options enable row level security;
alter table project_assets enable row level security;
alter table project_events enable row level security;

-- Clients can read only projects where their authenticated email is a member.
create policy "Clients can read their projects" on projects for select to authenticated
using (exists (select 1 from project_members m where m.project_id = projects.id and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))));

create policy "Clients can read their spaces" on project_spaces for select to authenticated
using (exists (select 1 from project_members m where m.project_id = project_spaces.project_id and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))));

create policy "Clients can read their options" on design_options for select to authenticated
using (exists (select 1 from project_members m join project_spaces s on s.project_id = m.project_id where s.id = design_options.space_id and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))));

create policy "Clients can read their assets" on project_assets for select to authenticated
using (exists (select 1 from project_members m where m.project_id = project_assets.project_id and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))));

create policy "Clients can read their membership" on project_members for select to authenticated
using (lower(email) = lower(coalesce(auth.jwt()->>'email','')));

-- No client write policies are intentionally created. Admin writes will use a server-only service role.
