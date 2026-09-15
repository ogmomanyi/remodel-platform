-- Client visual catalogue / presentation-board model.

create table if not exists presentation_boards (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  project_space_id uuid references project_spaces(id) on delete set null,
  board_code text not null,
  title text not null,
  subtitle text,
  board_type text not null check (board_type in ('overview','zone','detail','technical','before_after')),
  narrative text,
  key_features jsonb not null default '[]'::jsonb,
  layout_spec jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','ready','published','archived')),
  client_visible boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, board_code)
);

create table if not exists presentation_board_assets (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references presentation_boards(id) on delete cascade,
  asset_id uuid not null references project_assets(id) on delete cascade,
  role text not null check (role in ('hero','support','detail','plan','before','after','material')),
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(board_id, asset_id, role)
);

create index if not exists presentation_boards_project_idx
  on presentation_boards(project_id, sort_order);

create index if not exists presentation_boards_space_idx
  on presentation_boards(project_space_id, sort_order);

create index if not exists presentation_board_assets_board_idx
  on presentation_board_assets(board_id, sort_order);

alter table presentation_boards enable row level security;
alter table presentation_board_assets enable row level security;

drop policy if exists "Clients can read published presentation boards" on presentation_boards;
create policy "Clients can read published presentation boards"
  on presentation_boards
  for select
  to authenticated
  using (
    client_visible = true
    and status = 'published'
    and exists (
      select 1
      from project_members m
      where m.project_id = presentation_boards.project_id
        and lower(m.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );

drop policy if exists "Clients can read published presentation board assets" on presentation_board_assets;
create policy "Clients can read published presentation board assets"
  on presentation_board_assets
  for select
  to authenticated
  using (
    exists (
      select 1
      from presentation_boards b
      join project_members m on m.project_id = b.project_id
      where b.id = presentation_board_assets.board_id
        and b.client_visible = true
        and b.status = 'published'
        and lower(m.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );
