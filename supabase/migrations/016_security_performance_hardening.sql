-- Kota Designs: final security/performance hardening.

-- Lock function resolution to trusted schemas.
alter function public.prevent_locked_proposal_changes()
  set search_path = pg_catalog, public;

alter function public.prevent_locked_proposal_line_changes()
  set search_path = pg_catalog, public;

-- Legacy approval table: clients may read only their own project approval.
drop policy if exists "Allow authenticated insert/update" on project_approvals;
drop policy if exists "Allow authenticated read" on project_approvals;
drop policy if exists "Clients can read their project approval" on project_approvals;

revoke all on project_approvals from authenticated;
grant select (project_code, status, approved_by, approved_at)
  on project_approvals to authenticated;

create policy "Clients can read their project approval"
  on project_approvals
  for select
  to authenticated
  using (
    exists (
      select 1
      from projects p
      join project_members m on m.project_id = p.id
      where p.project_code = project_approvals.project_code
        and lower(m.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );

-- Raw design concepts are internal design-working data.
drop policy if exists "Clients can read their design concepts" on design_concepts;
revoke select on design_concepts from authenticated;

-- Replace RLS policies with init-plan friendly JWT lookups.
drop policy if exists "Clients can read their projects" on projects;
create policy "Clients can read their projects"
  on projects for select to authenticated
  using (
    exists (
      select 1 from project_members m
      where m.project_id = projects.id
        and lower(m.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );

drop policy if exists "Clients can read their spaces" on project_spaces;
create policy "Clients can read their spaces"
  on project_spaces for select to authenticated
  using (
    exists (
      select 1 from project_members m
      where m.project_id = project_spaces.project_id
        and lower(m.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );

drop policy if exists "Clients can read their membership" on project_members;
create policy "Clients can read their membership"
  on project_members for select to authenticated
  using (
    lower(email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  );

drop policy if exists "Clients can read project tasks" on project_tasks;
create policy "Clients can read project tasks"
  on project_tasks for select to authenticated
  using (
    client_visible = true
    and exists (
      select 1 from project_members m
      where m.project_id = project_tasks.project_id
        and lower(m.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );

drop policy if exists "Clients can read project progress" on project_progress_updates;
create policy "Clients can read project progress"
  on project_progress_updates for select to authenticated
  using (
    client_visible = true
    and exists (
      select 1 from project_members m
      where m.project_id = project_progress_updates.project_id
        and lower(m.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );

drop policy if exists "Clients can read their proposals" on proposals;
create policy "Clients can read their proposals"
  on proposals for select to authenticated
  using (
    status in ('sent','approved','rejected','expired','superseded')
    and exists (
      select 1 from project_members m
      where m.project_id = proposals.project_id
        and lower(m.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );

drop policy if exists "Clients can read their proposal lines" on proposal_lines;
create policy "Clients can read their proposal lines"
  on proposal_lines for select to authenticated
  using (
    exists (
      select 1
      from proposals p
      join project_members m on m.project_id = p.project_id
      where p.id = proposal_lines.proposal_id
        and p.status in ('sent','approved','rejected','expired','superseded')
        and lower(m.email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
    )
  );

-- Cover foreign keys frequently used by joins/deletes.
create index if not exists moodboard_items_asset_idx on moodboard_items(asset_id);
create index if not exists moodboards_design_concept_idx on moodboards(design_concept_id);
create index if not exists procurement_items_design_option_idx on procurement_items(design_option_id);
create index if not exists procurement_items_space_idx on procurement_items(project_space_id);
create index if not exists procurement_items_proposal_line_idx on procurement_items(proposal_line_id);
create index if not exists project_assets_design_option_idx on project_assets(design_option_id);
create index if not exists project_assets_space_idx on project_assets(space_id);
create index if not exists project_progress_task_idx on project_progress_updates(task_id);
create index if not exists proposal_lines_space_idx on proposal_lines(project_space_id);
create index if not exists visualisation_variants_asset_idx on visualisation_variants(asset_id);
create index if not exists visualisations_design_concept_idx on visualisations(design_concept_id);
create index if not exists visualisations_moodboard_idx on visualisations(moodboard_id);
create index if not exists visualisations_output_asset_idx on visualisations(output_asset_id);
create index if not exists visualisations_source_asset_idx on visualisations(source_asset_id);
