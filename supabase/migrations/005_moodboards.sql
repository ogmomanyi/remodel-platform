-- Kota Designs: Pinterest-style moodboards attached to spaces/design concepts.
-- Run after 003_design_concepts.sql.

create table if not exists moodboards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  project_space_id uuid references project_spaces(id) on delete cascade,
  design_concept_id uuid references design_concepts(id) on delete set null,
  name text not null,
  description text,
  style_direction text not null default 'modern',
  palette jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'draft' check (status in ('draft','proposed','selected','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists moodboard_items (
  id uuid primary key default gen_random_uuid(),
  moodboard_id uuid not null references moodboards(id) on delete cascade,
  asset_id uuid references project_assets(id) on delete cascade,
  title text not null,
  category text not null default 'inspiration',
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists moodboards_project_id_idx on moodboards(project_id, updated_at desc);
create index if not exists moodboards_space_id_idx on moodboards(project_space_id, updated_at desc);
create index if not exists moodboard_items_board_idx on moodboard_items(moodboard_id, sort_order);

alter table moodboards enable row level security;
alter table moodboard_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='moodboards' and policyname='Clients can read their moodboards') then
    create policy "Clients can read their moodboards" on moodboards for select to authenticated
    using (exists (select 1 from project_members m where m.project_id=moodboards.project_id and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='moodboard_items' and policyname='Clients can read their moodboard items') then
    create policy "Clients can read their moodboard items" on moodboard_items for select to authenticated
    using (exists (select 1 from moodboards b join project_members m on m.project_id=b.project_id where b.id=moodboard_items.moodboard_id and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))));
  end if;
end $$;
