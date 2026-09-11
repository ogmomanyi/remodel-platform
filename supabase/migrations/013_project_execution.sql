-- Kota Designs: project execution and site-progress layer.

create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  project_space_id uuid references project_spaces(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','blocked','done','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  assignee_name text,
  assignee_email text,
  start_date date,
  due_date date,
  completed_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_tasks_project_idx on project_tasks(project_id, status, due_date, sort_order);
create index if not exists project_tasks_space_idx on project_tasks(project_space_id, status);

create table if not exists project_progress_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  project_space_id uuid references project_spaces(id) on delete set null,
  task_id uuid references project_tasks(id) on delete set null,
  update_type text not null default 'site_visit' check (update_type in ('site_visit','milestone','status','issue','note')),
  title text not null,
  notes text,
  percent_complete integer not null default 0 check (percent_complete between 0 and 100),
  created_by_email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists project_progress_project_idx on project_progress_updates(project_id, created_at desc);
create index if not exists project_progress_space_idx on project_progress_updates(project_space_id, created_at desc);

alter table project_tasks enable row level security;
alter table project_progress_updates enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_tasks' and policyname='Clients can read project tasks') then
    create policy "Clients can read project tasks" on project_tasks for select to authenticated
    using (exists (select 1 from project_members m where m.project_id=project_tasks.project_id and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='project_progress_updates' and policyname='Clients can read project progress') then
    create policy "Clients can read project progress" on project_progress_updates for select to authenticated
    using (exists (select 1 from project_members m where m.project_id=project_progress_updates.project_id and lower(m.email)=lower(coalesce(auth.jwt()->>'email',''))));
  end if;
end $$;
