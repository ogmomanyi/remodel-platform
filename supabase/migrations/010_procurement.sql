-- Kota Designs: delivery/procurement foundation.
-- Procurement items are created from approved proposal line snapshots.

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  contact_name text,
  email text,
  phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists suppliers_active_idx on suppliers(active, name);

create table if not exists procurement_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  proposal_id uuid not null references proposals(id) on delete restrict,
  proposal_line_id uuid references proposal_lines(id) on delete set null,
  design_option_id uuid references design_options(id) on delete set null,
  project_space_id uuid references project_spaces(id) on delete set null,
  supplier_id uuid references suppliers(id) on delete set null,
  item_type text not null default 'material' check (item_type in ('material','service','package')),
  description text not null,
  quantity numeric(14,3) not null default 1 check (quantity >= 0),
  unit text not null default 'item',
  estimated_unit_cost numeric(14,2) not null default 0 check (estimated_unit_cost >= 0),
  estimated_total numeric(14,2) not null default 0 check (estimated_total >= 0),
  status text not null default 'planned' check (status in ('planned','quoted','ordered','partially_received','received','cancelled')),
  needed_by date,
  notes text,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(proposal_id, proposal_line_id, description)
);

create index if not exists procurement_items_project_idx on procurement_items(project_id, status, created_at desc);
create index if not exists procurement_items_supplier_idx on procurement_items(supplier_id, status);
create index if not exists procurement_items_proposal_idx on procurement_items(proposal_id);

alter table suppliers enable row level security;
alter table procurement_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='suppliers' and policyname='Authenticated users can read active suppliers') then
    create policy "Authenticated users can read active suppliers" on suppliers for select to authenticated using (active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='procurement_items' and policyname='Clients can read project procurement') then
    create policy "Clients can read project procurement" on procurement_items for select to authenticated
    using (exists (select 1 from project_members m where m.project_id=procurement_items.project_id and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))));
  end if;
end $$;
