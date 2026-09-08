'use server';

import { revalidatePath } from 'next/cache';
import { getProjectBySlug } from '@/lib/projects';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

type DesignElement = {
  id: string; type: 'room' | 'wall' | 'window' | 'door' | 'sofa' | 'table' | 'plant' | 'text';
  x: number; y: number; width: number; height: number; rotation: number;
  label?: string; finish?: string; accent?: string; material?: string;
};

function normaliseLegacyStatus(status: string | undefined) {
  const allowed = new Set(['draft', 'design', 'proposal', 'sent', 'approved', 'in_progress', 'completed', 'archived']);
  return status && allowed.has(status) ? status : 'draft';
}

async function resolveProject(projectSlug: string) {
  const supabase = createAdminClient();
  const { data: existingProject, error } = await supabase.from('projects').select('id, slug').eq('slug', projectSlug).maybeSingle();
  if (error) throw new Error(`Could not load the project: ${error.message}`);
  if (existingProject) return { supabase, project: existingProject };
  const legacy = getProjectBySlug(projectSlug);
  if (!legacy) throw new Error('Project not found.');
  const { data: created, error: createError } = await supabase.from('projects').insert({ project_code: legacy.project_code, slug: legacy.slug, client_name: legacy.client_name, description: typeof legacy.frontmatter.description === 'string' ? legacy.frontmatter.description : null, status: normaliseLegacyStatus(legacy.status) }).select('id, slug').single();
  const project = created ?? (await supabase.from('projects').select('id, slug').eq('slug', projectSlug).maybeSingle()).data;
  if (!project) throw new Error(`Could not create the project record: ${createError?.message || 'unknown database error'}`);
  const emails = Array.isArray(legacy.allowed_emails) ? legacy.allowed_emails : [];
  if (emails.length) await supabase.from('project_members').upsert(emails.map((email) => ({ project_id: project.id, email: String(email).trim().toLowerCase(), role: 'client' })), { onConflict: 'project_id,email' });
  return { supabase, project };
}

export async function saveScratchDesign(input: { projectSlug: string; designId?: string | null; name: string; spaceId?: string | null; elements: DesignElement[] }) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error('A design name is required.');
  if (!Array.isArray(input.elements) || input.elements.length > 500) throw new Error('The design contains an invalid number of elements.');
  const { supabase, project } = await resolveProject(input.projectSlug);
  if (input.spaceId) {
    const { data: space } = await supabase.from('project_spaces').select('id').eq('id', input.spaceId).eq('project_id', project.id).maybeSingle();
    if (!space) throw new Error('Selected space does not belong to this project.');
  }
  const payload = { project_id: project.id, project_space_id: input.spaceId || null, name, design_type: 'scratch', canvas_width: 760, canvas_height: 520, elements: input.elements, status: 'draft', updated_at: new Date().toISOString() };
  let saved;
  if (input.designId) {
    const { data: current } = await supabase.from('design_concepts').select('version').eq('id', input.designId).eq('project_id', project.id).maybeSingle();
    const { data, error } = await supabase.from('design_concepts').update({ ...payload, version: (current?.version ?? 1) + 1 }).eq('id', input.designId).eq('project_id', project.id).select('id, name, version, updated_at').single();
    if (error || !data) throw new Error(`Could not update the design: ${error?.message || 'design not found'}`); saved = data;
  } else {
    const { data, error } = await supabase.from('design_concepts').insert({ ...payload, created_by_email: 'admin' }).select('id, name, version, updated_at').single();
    if (error || !data) throw new Error(`Could not save the design: ${error?.message || 'unknown database error'}`); saved = data;
  }
  await supabase.from('project_events').insert({ project_id: project.id, event_type: input.designId ? 'design_concept_updated' : 'design_concept_created', metadata: { design_id: saved.id, design_type: 'scratch', name, space_id: input.spaceId || null } });
  revalidatePath(`/admin-dashboard/${project.slug}/edit`); revalidatePath(`/${project.slug}`); revalidatePath('/admin-dashboard');
  return saved;
}

export async function createSpace(input: { projectId: string; name: string; spaceType: string }) {
  await requireAdmin();
  const name = input.name.trim(); if (!name) throw new Error('Space name is required.');
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from('project_spaces').select('sort_order').eq('project_id', input.projectId).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase.from('project_spaces').insert({ project_id: input.projectId, name, space_type: input.spaceType, sort_order: (existing?.sort_order ?? -1) + 1 }).select('id, name, space_type, existing_notes').single();
  if (error || !data) throw new Error(`Could not create space: ${error?.message || 'unknown database error'}`);
  revalidatePath('/admin-dashboard'); return data;
}

export async function deleteSpace(input: { projectId: string; spaceId: string }) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from('project_spaces').delete().eq('id', input.spaceId).eq('project_id', input.projectId);
  if (error) throw new Error(`Could not delete space: ${error.message}`);
  revalidatePath('/admin-dashboard');
}

export async function createDesignOption(input: { spaceId: string; name: string; description: string; costEstimate: number | null; isRecommended: boolean }) {
  await requireAdmin();
  const name = input.name.trim(); if (!name) throw new Error('Option name is required.');
  if (input.costEstimate !== null && (!Number.isFinite(input.costEstimate) || input.costEstimate < 0)) throw new Error('Cost must be a valid positive number.');
  const supabase = createAdminClient();
  const { data: existing } = await supabase.from('design_options').select('sort_order').eq('space_id', input.spaceId).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  if (input.isRecommended) await supabase.from('design_options').update({ is_recommended: false }).eq('space_id', input.spaceId);
  const { data, error } = await supabase.from('design_options').insert({ space_id: input.spaceId, name, description: input.description.trim() || null, cost_estimate: input.costEstimate, is_recommended: input.isRecommended, sort_order: (existing?.sort_order ?? -1) + 1 }).select('id, name, description, cost_estimate, currency, status, is_recommended').single();
  if (error || !data) throw new Error(`Could not create design option: ${error?.message || 'unknown database error'}`);
  revalidatePath('/admin-dashboard'); return data;
}

export async function deleteDesignOption(input: { spaceId: string; optionId: string }) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from('design_options').delete().eq('id', input.optionId).eq('space_id', input.spaceId);
  if (error) throw new Error(`Could not delete design option: ${error.message}`);
  revalidatePath('/admin-dashboard');
}
