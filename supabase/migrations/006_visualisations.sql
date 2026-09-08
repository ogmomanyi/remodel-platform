-- Kota Designs: structured visualisation briefs and render outputs.
-- Run after 005_moodboards.sql.

create table if not exists visualisations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  project_space_id uuid references project_spaces(id) on delete set null,
  moodboard_id uuid references moodboards(id) on delete set null,
  design_concept_id uuid references design_concepts(id) on delete set null,
  source_asset_id uuid references project_assets(id) on delete set null,
  name text not null,
  prompt text not null,
  negative_prompt text,
  status text not null default 'brief' check (status in ('brief','queued','generating','ready','failed','archived')),
  provider text,
  output_asset_id uuid references project_assets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visualisations_project_idx on visualisations(project_id, updated_at desc);
create index if not exists visualisations_space_idx on visualisations(project_space_id, updated_at desc);

alter table visualisations enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='visualisations' and policyname='Clients can read their visualisations') then
    create policy "Clients can read their visualisations" on visualisations for select to authenticated
    using (exists (select 1 from project_members m where m.project_id=visualisations.project_id and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))));
  end if;
end $$;
