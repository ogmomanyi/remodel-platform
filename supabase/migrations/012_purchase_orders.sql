-- Kota Designs: purchase orders generated from procurement items.

create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  supplier_id uuid not null references suppliers(id) on delete restrict,
  po_number text not null unique,
  status text not null default 'draft' check (status in ('draft','sent','ordered','partially_received','received','cancelled')),
  currency text not null default 'KES',
  subtotal numeric(14,2) not null default 0 check (subtotal >= 0),
  notes text,
  expected_delivery date,
  ordered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, supplier_id, po_number)
);

create index if not exists purchase_orders_project_idx on purchase_orders(project_id, status, created_at desc);
create index if not exists purchase_orders_supplier_idx on purchase_orders(supplier_id, status);

create table if not exists purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references purchase_orders(id) on delete cascade,
  procurement_item_id uuid not null references procurement_items(id) on delete restrict,
  description text not null,
  quantity numeric(14,3) not null default 1 check (quantity >= 0),
  unit text not null default 'item',
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  line_total numeric(14,2) not null default 0 check (line_total >= 0),
  created_at timestamptz not null default now(),
  unique(purchase_order_id, procurement_item_id)
);

create index if not exists purchase_order_lines_po_idx on purchase_order_lines(purchase_order_id);
create index if not exists purchase_order_lines_item_idx on purchase_order_lines(procurement_item_id);

alter table purchase_orders enable row level security;
alter table purchase_order_lines enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='purchase_orders' and policyname='Clients can read project purchase orders') then
    create policy "Clients can read project purchase orders" on purchase_orders for select to authenticated
    using (exists (select 1 from project_members m where m.project_id=purchase_orders.project_id and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='purchase_order_lines' and policyname='Clients can read project purchase order lines') then
    create policy "Clients can read project purchase order lines" on purchase_order_lines for select to authenticated
    using (exists (select 1 from purchase_orders p join project_members m on m.project_id=p.project_id where p.id=purchase_order_lines.purchase_order_id and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))));
  end if;
end $$;
