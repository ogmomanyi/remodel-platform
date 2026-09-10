-- Preserve every generated render as a first-class variant record.
create table if not exists visualisation_variants (
  id uuid primary key default gen_random_uuid(),
  visualisation_id uuid not null references visualisations(id) on delete cascade,
  asset_id uuid not null references project_assets(id) on delete restrict,
  variant_key text not null,
  prompt text,
  provider text,
  model text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  unique(visualisation_id, variant_key)
);

create index if not exists visualisation_variants_job_idx on visualisation_variants(visualisation_id, created_at desc);
create unique index if not exists visualisation_variants_one_selected_idx
  on visualisation_variants(visualisation_id)
  where is_selected = true;

alter table visualisation_variants enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='visualisation_variants' and policyname='Clients can read visualisation variants') then
    create policy "Clients can read visualisation variants" on visualisation_variants for select to authenticated
    using (exists (
      select 1 from visualisations v
      join project_members m on m.project_id=v.project_id
      where v.id=visualisation_variants.visualisation_id
      and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))
    ));
  end if;
end $$;
