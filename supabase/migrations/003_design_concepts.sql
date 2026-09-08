-- Kota Designs: first-class persisted scratch design concepts.
-- Run after 002_design_studio.sql.

create table if not exists design_concepts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  project_space_id uuid references project_spaces(id) on delete set null,
  name text not null,
  design_type text not null default 'scratch' check (design_type in ('scratch','moodboard','render')),
  canvas_width integer not null default 760 check (canvas_width between 100 and 5000),
  canvas_height integer not null default 520 check (canvas_height between 100 and 5000),
  elements jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','proposed','selected','archived')),
  version integer not null default 1 check (version > 0),
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists design_concepts_project_id_idx on design_concepts(project_id, updated_at desc);
create index if not exists design_concepts_space_id_idx on design_concepts(project_space_id, updated_at desc);

alter table design_concepts enable row level security;

-- Idempotent policy creation for fresh Supabase projects.
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'design_concepts' and policyname = 'Clients can read their design concepts'
  ) then
    create policy "Clients can read their design concepts" on design_concepts for select to authenticated
    using (exists (
      select 1 from project_members m
      where m.project_id = design_concepts.project_id
        and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))
    ));
  end if;
end $$;

-- Admin writes use the service role and intentionally bypass RLS.
