-- Kota Designs: client visibility controls for execution records.

alter table project_tasks
  add column if not exists client_visible boolean not null default true;

alter table project_progress_updates
  add column if not exists client_visible boolean not null default true;

create index if not exists project_tasks_client_visibility_idx
  on project_tasks(project_id, client_visible, status, due_date);

create index if not exists project_progress_client_visibility_idx
  on project_progress_updates(project_id, client_visible, created_at desc);

-- Replace broad project-member read policies with client-visible-only policies.
drop policy if exists "Clients can read project tasks" on project_tasks;
create policy "Clients can read project tasks"
  on project_tasks for select to authenticated
  using (
    client_visible = true
    and exists (
      select 1
      from project_members m
      where m.project_id = project_tasks.project_id
        and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))
    )
  );

drop policy if exists "Clients can read project progress" on project_progress_updates;
create policy "Clients can read project progress"
  on project_progress_updates for select to authenticated
  using (
    client_visible = true
    and exists (
      select 1
      from project_members m
      where m.project_id = project_progress_updates.project_id
        and lower(m.email) = lower(coalesce(auth.jwt()->>'email',''))
    )
  );
