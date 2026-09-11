'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

const TASK_STATUSES = ['todo', 'in_progress', 'blocked', 'done', 'cancelled'] as const;
const PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const UPDATE_TYPES = ['site_visit', 'milestone', 'status', 'issue', 'note'] as const;

async function getProject(slug: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('projects').select('id, slug').eq('slug', slug).maybeSingle();
  if (error || !data) throw new Error(`Project not found: ${error?.message || 'unknown error'}`);
  return { supabase, project: data };
}

function revalidateExecution(slug: string) {
  revalidatePath(`/admin-dashboard/${slug}/execution`);
  revalidatePath(`/${slug}`);
  revalidatePath('/client-dashboard');
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
  clientVisible?: boolean;
}) {
  await requireAdmin();
  const title = input.title.trim();
  if (!input.projectSlug?.trim()) throw new Error('Project is required.');
  if (!title) throw new Error('Task title is required.');
  if (input.priority && !PRIORITIES.includes(input.priority as typeof PRIORITIES[number])) throw new Error('Invalid task priority.');

  const { supabase, project } = await getProject(input.projectSlug);

  if (input.projectSpaceId) {
    const { data: space } = await supabase.from('project_spaces').select('id').eq('id', input.projectSpaceId).eq('project_id', project.id).maybeSingle();
    if (!space) throw new Error('Selected space does not belong to this project.');
  }

  const { data: task, error } = await supabase.from('project_tasks').insert({
    project_id: project.id,
    project_space_id: input.projectSpaceId || null,
    title,
    description: input.description?.trim() || null,
    priority: input.priority || 'medium',
    assignee_name: input.assigneeName?.trim() || null,
    assignee_email: input.assigneeEmail?.trim().toLowerCase() || null,
    start_date: input.startDate || null,
    due_date: input.dueDate || null,
    client_visible: input.clientVisible ?? true,
  }).select('id, title, status, priority, client_visible').single();

  if (error || !task) throw new Error(`Could not create task: ${error?.message || 'unknown error'}`);

  await supabase.from('project_events').insert({
    project_id: project.id,
    event_type: 'task_created',
    metadata: { task_id: task.id, title: task.title, priority: task.priority, client_visible: task.client_visible },
  });

  revalidateExecution(project.slug);
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
  clientVisible?: boolean;
}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: task, error } = await supabase.from('project_tasks').select('id, project_id, status, title, client_visible').eq('id', input.taskId).maybeSingle();
  if (error || !task) throw new Error(`Task not found: ${error?.message || 'unknown error'}`);
  if (input.status && !TASK_STATUSES.includes(input.status as typeof TASK_STATUSES[number])) throw new Error('Invalid task status.');
  if (input.priority && !PRIORITIES.includes(input.priority as typeof PRIORITIES[number])) throw new Error('Invalid task priority.');

  const nextStatus = input.status || task.status;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    completed_at: nextStatus === 'done' ? new Date().toISOString() : null,
  };

  if (input.status) patch.status = input.status;
  if (input.priority) patch.priority = input.priority;
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new Error('Task title is required.');
    patch.title = title;
  }
  if (input.description !== undefined) patch.description = input.description.trim() || null;
  if (input.assigneeName !== undefined) patch.assignee_name = input.assigneeName.trim() || null;
  if (input.assigneeEmail !== undefined) patch.assignee_email = input.assigneeEmail.trim().toLowerCase() || null;
  if (input.startDate !== undefined) patch.start_date = input.startDate || null;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate || null;
  if (input.clientVisible !== undefined) patch.client_visible = input.clientVisible;

  const { error: updateError } = await supabase.from('project_tasks').update(patch).eq('id', task.id);
  if (updateError) throw new Error(`Could not update task: ${updateError.message}`);

  const { data: project } = await supabase.from('projects').select('slug').eq('id', task.project_id).maybeSingle();
  if (project) {
    await supabase.from('project_events').insert({
      project_id: task.project_id,
      event_type: 'task_updated',
      metadata: {
        task_id: task.id,
        title: input.title?.trim() || task.title,
        status: nextStatus,
        client_visible: input.clientVisible ?? task.client_visible,
      },
    });
    revalidateExecution(project.slug);
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
  clientVisible?: boolean;
}) {
  await requireAdmin();
  const title = input.title.trim();
  if (!input.projectSlug?.trim()) throw new Error('Project is required.');
  if (!title) throw new Error('Update title is required.');
  if (input.updateType && !UPDATE_TYPES.includes(input.updateType as typeof UPDATE_TYPES[number])) throw new Error('Invalid update type.');

  const percent = Number(input.percentComplete ?? 0);
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Progress must be between 0 and 100.');

  const { supabase, project } = await getProject(input.projectSlug);

  if (input.projectSpaceId) {
    const { data: space } = await supabase.from('project_spaces').select('id').eq('id', input.projectSpaceId).eq('project_id', project.id).maybeSingle();
    if (!space) throw new Error('Selected space does not belong to this project.');
  }

  if (input.taskId) {
    const { data: task } = await supabase.from('project_tasks').select('id').eq('id', input.taskId).eq('project_id', project.id).maybeSingle();
    if (!task) throw new Error('Selected task does not belong to this project.');
  }

  const { data: update, error } = await supabase.from('project_progress_updates').insert({
    project_id: project.id,
    project_space_id: input.projectSpaceId || null,
    task_id: input.taskId || null,
    update_type: input.updateType || 'site_visit',
    title,
    notes: input.notes?.trim() || null,
    percent_complete: Math.round(percent),
    client_visible: input.clientVisible ?? true,
  }).select('id, title, percent_complete, client_visible, created_at').single();

  if (error || !update) throw new Error(`Could not create progress update: ${error?.message || 'unknown error'}`);

  await supabase.from('project_events').insert({
    project_id: project.id,
    event_type: 'progress_update_created',
    metadata: {
      progress_update_id: update.id,
      title,
      percent_complete: update.percent_complete,
      client_visible: update.client_visible,
    },
  });

  revalidateExecution(project.slug);
  return update;
}
