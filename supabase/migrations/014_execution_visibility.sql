-- Kota Designs: client visibility controls for execution records.

alter table project_tasks
  add column if not exists client_visible boolean not null default true;

alter table project_progress_updates
  add column if not exists client_visible boolean not null default true;

create index if not exists project_tasks_client_visibility_idx
  on project_tasks(project_id, client_visible, status, due_date);

create index if not exists project_progress_client_visibility_idx
  on project_progress_updates(project_id, client_visible, created_at desc);
