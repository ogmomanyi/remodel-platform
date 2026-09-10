-- Track the selected render variant without changing the underlying brief.
alter table visualisations
  add column if not exists variant_key text not null default 'primary',
  add column if not exists is_selected boolean not null default false;

create index if not exists visualisations_selected_idx
  on visualisations(project_space_id, is_selected, updated_at desc);

-- A single selected render per project/space. PostgreSQL treats NULLs as distinct,
-- which is desirable for project-level visualisations.
create unique index if not exists visualisations_one_selected_per_space_idx
  on visualisations(project_space_id)
  where is_selected = true and project_space_id is not null;
