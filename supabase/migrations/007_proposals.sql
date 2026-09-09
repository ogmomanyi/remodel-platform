-- Kota Designs: commercial proposal / quotation layer.
-- Run after 006_visualisations.sql.

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  proposal_number text not null,
  version integer not null default 1,
  title text not null default 'Renovation Proposal',
  status text not null default 'draft' check (status in ('draft','sent','approved','rejected','expired','superseded')),
  currency text not null default 'KES',
  markup_percent numeric(8,2) not null default 0,
  tax_percent numeric(8,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text,
  valid_until date,
  sent_at timestamptz,
  approved_at timestamptz,
  approved_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, version),
  unique(proposal_number)
);

create index if not exists proposals_project_idx on proposals(project_id, version desc);

create table if not exists proposal_lines (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals(id) on delete cascade,
  project_space_id uuid references project_spaces(id) on delete set null,
  design_option_id uuid references design_options(id) on delete set null,
  line_type text not null default 'design_option' check (line_type in ('design_option','material','service','adjustment')),
  description text not null,
  quantity numeric(14,3) not null default 1 check (quantity >= 0),
  unit text not null default 'item',
  internal_unit_cost numeric(14,2) not null default 0 check (internal_unit_cost >= 0),
  selling_unit_price numeric(14,2) not null default 0 check (selling_unit_price >= 0),
  internal_total numeric(14,2) not null default 0 check (internal_total >= 0),
  selling_total numeric(14,2) not null default 0 check (selling_total >= 0),
  source_snapshot jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists proposal_lines_proposal_idx on proposal_lines(proposal_id, sort_order);
create index if not exists proposal_lines_option_idx on proposal_lines(design_option_id);

alter table proposals enable row level security;
alter table proposal_lines enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='proposals' and policyname='Clients can read their proposals') then
    create policy "Clients can read their proposals" on proposals for select to authenticated
    using (exists (select 1 from project_members m where m.project_id=proposals.project_id and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='proposal_lines' and policyname='Clients can read their proposal lines') then
    create policy "Clients can read their proposal lines" on proposal_lines for select to authenticated
    using (exists (select 1 from proposals p join project_members m on m.project_id=p.project_id where p.id=proposal_lines.proposal_id and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))));
  end if;
end $$;
