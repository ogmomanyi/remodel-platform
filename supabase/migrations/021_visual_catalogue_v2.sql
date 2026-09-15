-- Visual Catalogue v2: document-level metadata + 12-page template system.

create table if not exists presentation_catalogues (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  version integer not null default 1,
  status text not null default 'draft'
    check (status in ('draft','internal_review','client_ready','published','archived')),
  title text not null,
  subtitle text,
  brand_name text,
  brand_tagline text,
  theme_key text not null default 'editorial_residential',
  quoted_contract_sum numeric,
  currency text not null default 'KES',
  master_visualisation_id uuid references visualisations(id) on delete set null,
  master_asset_id uuid references project_assets(id) on delete set null,
  cover_asset_id uuid references project_assets(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, version)
);

alter table presentation_boards
  add column if not exists catalogue_id uuid references presentation_catalogues(id) on delete cascade,
  add column if not exists page_number integer,
  add column if not exists template_key text,
  add column if not exists section_label text,
  add column if not exists eyebrow text,
  add column if not exists content_json jsonb not null default '{}'::jsonb,
  add column if not exists data_bindings jsonb not null default '{}'::jsonb,
  add column if not exists approval_status text not null default 'draft'
    check (approval_status in ('draft','internal_review','approved','changes_required'));

alter table presentation_boards
  drop constraint if exists presentation_boards_board_type_check;

alter table presentation_boards
  add constraint presentation_boards_board_type_check
  check (board_type in (
    'cover',
    'approved_concept',
    'overview',
    'zone',
    'detail',
    'work_package',
    'technical',
    'before_after',
    'internal_work',
    'commercial_summary'
  ));

alter table presentation_board_assets
  drop constraint if exists presentation_board_assets_role_check;

alter table presentation_board_assets
  add constraint presentation_board_assets_role_check
  check (role in (
    'hero',
    'support',
    'detail',
    'plan',
    'before',
    'after',
    'material',
    'logo',
    'diagram',
    'reference'
  ));

create index if not exists presentation_catalogues_project_idx
  on presentation_catalogues(project_id, version desc);

create index if not exists presentation_boards_catalogue_idx
  on presentation_boards(catalogue_id, page_number);

alter table presentation_catalogues enable row level security;

drop policy if exists "Clients can read published catalogues" on presentation_catalogues;
create policy "Clients can read published catalogues"
  on presentation_catalogues
  for select
  to authenticated
  using (
    status = 'published'
    and exists (
      select 1
      from project_members m
      where m.project_id = presentation_catalogues.project_id
        and lower(m.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );
