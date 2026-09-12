-- Brief-constrained visualisation pipeline.
-- Site-accurate renders must use a real source image; concept renders may be text-led.

alter table visualisations
  add column if not exists fidelity_mode text not null default 'concept'
    check (fidelity_mode in ('concept','site_accurate')),
  add column if not exists brief_json jsonb not null default '{}'::jsonb,
  add column if not exists brief_version integer not null default 1,
  add column if not exists requires_source_asset boolean not null default false;

create index if not exists visualisations_fidelity_idx
  on visualisations(project_id, fidelity_mode, created_at desc);

comment on column visualisations.fidelity_mode is
  'concept = free/concept generation; site_accurate = source-image edit constrained by project brief';
comment on column visualisations.brief_json is
  'Structured render brief containing project, space, topology, materials, quantities and non-negotiable constraints.';
