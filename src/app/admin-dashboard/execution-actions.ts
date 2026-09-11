'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const UPDATE_TYPES = ['site_visit', 'milestone', 'status', 'issue', 'note'] as const;

function assertProjectSlug(slug: string) {
  if (!slug?.trim()) throw new Error('Project is required.');
}

async function getProject(slug: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('projects').select('id, slug').eq('slug', slug).maybeSingle();
  if (error || !data) throw new Error(`Project not found: ${error?.message || 'unknown error'}`);
  return { supabase, project: data };
}

export async function createProjectTask(input: {
  projectSlug: string;
  projectSpaceId?: string;
  title: string;
  description?: string;
  priority?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  startDate?: string;
  dueDate?: string;
}) {
  await requireAdmin();
  assertProjectSlug(input.projectSlug);
  const title = input.title.trim();
  if (!title) throw new Error('Task title is required.');
  if (input.priority && !PRIORITIES.includes(input.priority as typeof PRIORITIES[number])) throw new Error('Invalid task priority.');
  const { supabase, project } = await getProject(input.projectSlug);
  const { data: task, error } = await supabase.from('project_tasks').insert({
    project_id: project.id,
    project_space_id: input.projectSpaceId || null,
    title,
    description: input.description?.trim() || null,
    priority: input.priority || 'medium',
    assignee_name: input.assigneeName?.trim() || null,
    assignee_email: input.assigneeEmail?.trim() || null,
    start_date: input.startDate || null,
    due_date: input.dueDate || null,
  }).select('id, title, status, priority').single();
  if (error || !task) throw new Error(`Could not create task: ${error?.message || 'unknown error'}`);
  await supabase.from('project_events').insert({ project_id: project.id, event_type: 'task_created', metadata: { task_id: task.id, title: task.title, priority: task.priority } });
  revalidatePath(`/admin-dashboard/${project.slug}/execution`);
  return task;
}

export async function updateProjectTask(input: {
  taskId: string;
  status?: string;
  priority?: string;
  title?: string;
  description?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  startDate?: string;
  dueDate?: string;
}) {
  await requireAdmin();
  const { supabase } = await getProject('placeholder').catch(() => ({ supabase: createAdminClient(), project: null as never }));
  const { data: task, error } = await supabase.from('project_tasks').select('id, project_id, status, title').eq('id', input.taskId).maybeSingle();
  if (error || !task) throw new Error(`Task not found: ${error?.message || 'unknown error'}`);
  if (input.status && !TASK_STATUSES.includes(input.status as typeof TASK_STATUSES[number])) throw new Error('Invalid task status.');
  if (input.priority && !PRIORITIES.includes(input.priority as typeof PRIORITIES[number])) throw new Error('Invalid task priority.');
  const nextStatus = input.status || task.status;
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status) patch.status = input.status;
  if (input.priority) patch.priority = input.priority;
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description.trim() || null;
  if (input.assigneeName !== undefined) patch.assignee_name = input.assigneeName.trim() || null;
  if (input.assigneeEmail !== undefined) patch.assignee_email = input.assigneeEmail.trim() || null;
  if (input.startDate !== undefined) patch.start_date = input.startDate || null;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate || null;
  patch.completed_at = nextStatus === 'done' ? new Date().toISOString() : null;
  const { error: updateError } = await supabase.from('project_tasks').update(patch).eq('id', task.id);
  if (updateError) throw new Error(`Could not update task: ${updateError.message}`);
  const { data: project } = await supabase.from('projects').select('slug').eq('id', task.project_id).maybeSingle();
  if (project) {
    await supabase.from('project_events').insert({ project_id: task.project_id, event_type: 'task_updated', metadata: { task_id: task.id, title: input.title?.trim() || task.title, status: nextStatus } });
    revalidatePath(`/admin-dashboard/${project.slug}/execution`);
  }
}

export async function createProgressUpdate(input: {
  projectSlug: string;
  projectSpaceId?: string;
  taskId?: string;
  updateType?: string;
  title: string;
  notes?: string;
  percentComplete?: number;
}) {
  await requireAdmin();
  assertProjectSlug(input.projectSlug);
  const title = input.title.trim();
  if (!title) throw new Error('Update title is required.');
  if (input.updateType && !UPDATE_TYPES.includes(input.updateType as typeof UPDATE_TYPES[number])) throw new Error('Invalid update type.');
  const percent = Number(input.percentComplete ?? 0);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Progress must be between 0 and 100.');
  const { supabase, project } = await getProject(input.projectSlug);
  const { data: update, error } = await supabase.from('project_progress_updates').insert({
    project_id: project.id,
    project_space_id: input.projectSpaceId || null,
    task_id: input.taskId || null,
    update_type: input.updateType || 'site_visit',
    title,
    notes: input.notes?.trim() || null,
    percent_complete: Math.round(percent),
  }).select('id, title, percent_complete, created_at').single();
  if (error || !update) throw new Error(`Could not create progress update: ${error?.message || 'unknown error'}`);
  await supabase.from('project_events').insert({ project_id: project.id, event_type: 'progress_update_created', metadata: { progress_update_id: update.id, title, percent_complete: update.percent_complete } });
  revalidatePath(`/admin-dashboard/${project.slug}/execution`);
  revalidatePath(`/admin-dashboard/${project.slug}`);
  return update;
}
