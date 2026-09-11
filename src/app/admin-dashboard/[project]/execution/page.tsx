import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { createProjectTask, updateProjectTask, createProgressUpdate } from '@/app/admin-dashboard/execution-actions';
import { ExecutionMediaManager } from '@/components/admin/ExecutionMediaManager';

const STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const UPDATE_TYPES = {
  site_visit: 'Site visit',
  milestone: 'Milestone',
  status: 'Status',
  issue: 'Issue',
  note: 'Note',
};

export default async function ExecutionPage({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin();
  const { project: slug } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, slug, project_code, client_name, status')
    .eq('slug', slug)
    .maybeSingle();

  if (!project) notFound();

  const [
    { data: spaces },
    { data: tasks },
    { data: updates },
    { data: procurement },
    { data: progressAssets },
  ] = await Promise.all([
    supabase.from('project_spaces').select('id, name, space_type').eq('project_id', project.id).order('sort_order'),
    supabase.from('project_tasks').select('id, project_space_id, title, description, status, priority, assignee_name, due_date, start_date, completed_at, client_visible').eq('project_id', project.id).order('sort_order').order('due_date'),
    supabase.from('project_progress_updates').select('id, project_space_id, task_id, update_type, title, notes, percent_complete, client_visible, created_at').eq('project_id', project.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('procurement_items').select('id, status').eq('project_id', project.id),
    supabase.from('project_assets').select('id, space_id, kind, storage_path, alt_text, created_at').eq('project_id', project.id).eq('kind', 'progress').order('created_at', { ascending: false }).limit(20),
  ]);

  const signedProgressAssets = await Promise.all(
    (progressAssets ?? []).map(async (asset) => {
      const { data } = await supabase.storage.from('project-assets').createSignedUrl(asset.storage_path, 60 * 60);
      return { ...asset, signed_url: data?.signedUrl ?? null };
    }),
  );

  const allTasks = tasks ?? [];
  const relevantTasks = allTasks.filter((task) => task.status !== 'cancelled');
  const done = relevantTasks.filter((task) => task.status === 'done').length;
  const active = relevantTasks.filter((task) => !['done'].includes(task.status)).length;
  const blocked = relevantTasks.filter((task) => task.status === 'blocked').length;
  const latestReportedProgress = updates?.[0]?.percent_complete ?? 0;
  const taskProgress = relevantTasks.length ? Math.round((done / relevantTasks.length) * 100) : 0;
  const overall = updates?.length ? latestReportedProgress : taskProgress;
  const overdue = relevantTasks.filter(
    (task) => task.due_date && task.status !== 'done' && new Date(`${task.due_date}T23:59:59`) < new Date(),
  ).length;
  const procurementOrdered = (procurement ?? []).filter((item) =>
    ['ordered', 'partially_received', 'received'].includes(item.status),
  ).length;

  const spaceName = (id: string | null) => spaces?.find((space) => space.id === id)?.name || 'General project';
  const taskTitle = (id: string | null) => allTasks.find((task) => task.id === id)?.title || null;

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/admin-dashboard" className="text-sm text-stone-500 hover:text-stone-900">← Dashboard</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              {project.project_code} · {project.client_name}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Project Execution</h1>
            <p className="mt-1 text-sm text-stone-500">Control site work, delivery evidence and client-facing progress from one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin-dashboard/${slug}/procurement`} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Procurement</Link>
            <Link href={`/admin-dashboard/${slug}/procurement/orders`} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Purchase orders</Link>
            <Link href={`/admin-dashboard/${slug}/edit`} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium">Design Studio</Link>
            <Link href={`/${slug}`} target="_blank" className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white">Client view ↗</Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <Metric label="Overall progress" value={`${overall}%`} progress={overall} />
          <Metric label="Active tasks" value={String(active)} />
          <Metric label="Blocked" value={String(blocked)} attention={blocked > 0} />
          <Metric label="Overdue" value={String(overdue)} attention={overdue > 0} />
          <Metric label="Procurement ordered" value={`${procurementOrdered} / ${(procurement ?? []).length}`} />
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
          <section className="rounded-3xl border border-stone-200 bg-white">
            <div className="border-b border-stone-200 px-6 py-4">
              <h2 className="font-semibold">Execution tasks</h2>
              <p className="mt-1 text-xs text-stone-500">Assign, schedule and decide exactly what the client can see.</p>
            </div>

            <div className="border-b border-stone-100 p-6">
              <form
                action={async (fd) => {
                  'use server';
                  await createProjectTask({
                    projectSlug: slug,
                    projectSpaceId: String(fd.get('spaceId') || ''),
                    title: String(fd.get('title') || ''),
                    priority: String(fd.get('priority') || 'medium'),
                    assigneeName: String(fd.get('assigneeName') || ''),
                    assigneeEmail: String(fd.get('assigneeEmail') || ''),
                    startDate: String(fd.get('startDate') || ''),
                    dueDate: String(fd.get('dueDate') || ''),
                    description: String(fd.get('description') || ''),
                    clientVisible: fd.get('clientVisible') === 'on',
                  });
                }}
                className="grid gap-3 md:grid-cols-2"
              >
                <input name="title" required placeholder="Task title" className="rounded-xl border border-stone-300 px-3 py-2 text-sm md:col-span-2" />
                <textarea name="description" placeholder="Scope / instructions" rows={2} className="rounded-xl border border-stone-300 px-3 py-2 text-sm md:col-span-2" />
                <select name="spaceId" className="rounded-xl border border-stone-300 px-3 py-2 text-sm">
                  <option value="">General project</option>
                  {spaces?.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
                </select>
                <select name="priority" defaultValue="medium" className="rounded-xl border border-stone-300 px-3 py-2 text-sm">
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input name="assigneeName" placeholder="Assignee name" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" />
                <input type="email" name="assigneeEmail" placeholder="Assignee email (optional)" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" />
                <input type="date" name="startDate" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" />
                <input type="date" name="dueDate" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" />
                <label className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm md:col-span-2">
                  <input type="checkbox" name="clientVisible" defaultChecked />
                  Show this task in the client portal
                </label>
                <button className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white md:col-span-2">Add task</button>
              </form>
            </div>

            <div className="divide-y divide-stone-100">
              {!allTasks.length ? (
                <p className="p-6 text-sm text-stone-500">No execution tasks yet.</p>
              ) : allTasks.map((task) => (
                <div key={task.id} className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-stone-900">{task.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${task.client_visible ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                          {task.client_visible ? 'CLIENT VISIBLE' : 'INTERNAL'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-stone-500">
                        {spaceName(task.project_space_id)} · {task.assignee_name || 'Unassigned'}
                        {task.due_date ? ` · Due ${task.due_date}` : ''}
                      </p>
                      {task.description && <p className="mt-2 text-sm leading-6 text-stone-600">{task.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium">{PRIORITY_LABELS[task.priority] || task.priority}</span>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs">{STATUS_LABELS[task.status] || task.status}</span>
                    </div>
                  </div>

                  <form
                    action={async (fd) => {
                      'use server';
                      await updateProjectTask({
                        taskId: task.id,
                        status: String(fd.get('status')),
                        priority: String(fd.get('priority')),
                        clientVisible: fd.get('clientVisible') === 'on',
                      });
                    }}
                    className="mt-4 flex flex-wrap items-center gap-2"
                  >
                    <select name="status" defaultValue={task.status} className="rounded-xl border border-stone-300 px-3 py-2 text-xs">
                      {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <select name="priority" defaultValue={task.priority} className="rounded-xl border border-stone-300 px-3 py-2 text-xs">
                      {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <label className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs">
                      <input type="checkbox" name="clientVisible" defaultChecked={task.client_visible} />
                      Client visible
                    </label>
                    <button className="rounded-xl border border-stone-300 px-3 py-2 text-xs font-medium">Save</button>
                  </form>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-stone-200 bg-white">
              <div className="border-b border-stone-200 px-6 py-4">
                <h2 className="font-semibold">Site progress update</h2>
                <p className="mt-1 text-xs text-stone-500">Publish client milestones or keep sensitive site notes internal.</p>
              </div>
              <div className="p-6">
                <form
                  action={async (fd) => {
                    'use server';
                    await createProgressUpdate({
                      projectSlug: slug,
                      projectSpaceId: String(fd.get('spaceId') || ''),
                      taskId: String(fd.get('taskId') || ''),
                      updateType: String(fd.get('updateType') || 'site_visit'),
                      title: String(fd.get('title') || ''),
                      notes: String(fd.get('notes') || ''),
                      percentComplete: Number(fd.get('percentComplete') || 0),
                      clientVisible: fd.get('clientVisible') === 'on',
                    });
                  }}
                  className="space-y-3"
                >
                  <input name="title" required placeholder="e.g. Electrical first fix completed" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
                  <div className="grid grid-cols-2 gap-3">
                    <select name="updateType" className="rounded-xl border border-stone-300 px-3 py-2 text-sm">
                      {Object.entries(UPDATE_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <input type="number" name="percentComplete" min="0" max="100" defaultValue={overall} className="rounded-xl border border-stone-300 px-3 py-2 text-sm" />
                  </div>
                  <select name="spaceId" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm">
                    <option value="">General project</option>
                    {spaces?.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
                  </select>
                  <select name="taskId" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm">
                    <option value="">No linked task</option>
                    {allTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                  </select>
                  <textarea name="notes" rows={4} placeholder="What changed? Any decisions or next steps?" className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm" />
                  <label className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2 text-sm">
                    <input type="checkbox" name="clientVisible" defaultChecked />
                    Publish this update to the client portal
                  </label>
                  <button className="w-full rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white">Post progress update</button>
                </form>
              </div>
            </section>

            <ExecutionMediaManager
              projectId={project.id}
              spaces={(spaces ?? []).map(({ id, name }) => ({ id, name }))}
              initialAssets={signedProgressAssets}
            />

            <section className="rounded-3xl border border-stone-200 bg-white">
              <div className="border-b border-stone-200 px-6 py-4"><h2 className="font-semibold">Recent updates</h2></div>
              {!updates?.length ? (
                <p className="p-6 text-sm text-stone-500">No progress updates yet.</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {updates.map((update) => (
                    <div key={update.id} className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium text-sm">{update.title}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${update.client_visible ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                              {update.client_visible ? 'PUBLISHED' : 'INTERNAL'}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-stone-500">
                            {UPDATE_TYPES[update.update_type as keyof typeof UPDATE_TYPES] || update.update_type} · {spaceName(update.project_space_id)}
                            {taskTitle(update.task_id) ? ` · ${taskTitle(update.task_id)}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-semibold">{update.percent_complete}%</span>
                      </div>
                      {update.notes && <p className="mt-3 text-sm leading-6 text-stone-600">{update.notes}</p>}
                      <p className="mt-2 text-[11px] text-stone-400">{new Date(update.created_at).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  progress,
  attention = false,
}: {
  label: string;
  value: string;
  progress?: number;
  attention?: boolean;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-5 ${attention ? 'border-amber-300' : 'border-stone-200'}`}>
      <p className="text-xs uppercase tracking-wider text-stone-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${attention ? 'text-amber-700' : 'text-stone-900'}`}>{value}</p>
      {progress !== undefined && (
        <div className="mt-3 h-2 rounded-full bg-stone-100">
          <div className="h-2 rounded-full bg-stone-900" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
        </div>
      )}
    </div>
  );
}
