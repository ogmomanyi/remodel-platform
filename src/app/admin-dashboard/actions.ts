'use server';

import { revalidatePath } from 'next/cache';
import { getProjectBySlug } from '@/lib/projects';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

type DesignElement = {
  id: string;
  type: 'room' | 'wall' | 'window' | 'door' | 'sofa' | 'table' | 'plant' | 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label?: string;
  finish?: string;
  accent?: string;
  material?: string;
};

function normaliseLegacyStatus(status: string | undefined) {
  const allowed = new Set(['draft', 'design', 'proposal', 'sent', 'approved', 'in_progress', 'completed', 'archived']);
  return status && allowed.has(status) ? status : 'draft';
}

export async function saveScratchDesign(input: {
  projectSlug: string;
  designId?: string | null;
  name: string;
  spaceId?: string | null;
  elements: DesignElement[];
}) {
  await requireAdmin();

  const name = input.name.trim();
  if (!name) throw new Error('A design name is required.');
  if (!Array.isArray(input.elements) || input.elements.length > 500) {
    throw new Error('The design contains an invalid number of elements.');
  }

  const supabase = createAdminClient();
  let project: { id: string; slug: string } | null = null;

  const { data: existingProject, error: projectLookupError } = await supabase
    .from('projects')
    .select('id, slug')
    .eq('slug', input.projectSlug)
    .maybeSingle();

  if (projectLookupError) {
    throw new Error(`Could not load the project: ${projectLookupError.message}`);
  }

  project = existingProject;

  // Older Kota projects were stored as MDX only. When a designer first saves a
  // scratch concept, promote that project into the relational schema so the new
  // Design Studio works without requiring a manual migration for every project.
  if (!project) {
    const legacyProject = getProjectBySlug(input.projectSlug);
    if (!legacyProject) throw new Error('Project not found.');

    const { data: createdProject, error: createProjectError } = await supabase
      .from('projects')
      .insert({
        project_code: legacyProject.project_code,
        slug: legacyProject.slug,
        client_name: legacyProject.client_name,
        description: typeof legacyProject.frontmatter.description === 'string' ? legacyProject.frontmatter.description : null,
        status: normaliseLegacyStatus(legacyProject.status),
      })
      .select('id, slug')
      .single();

    if (createdProject) {
      project = createdProject;
    } else {
      // Another request may have promoted the same legacy project concurrently.
      const { data: concurrentProject } = await supabase
        .from('projects')
        .select('id, slug')
        .eq('slug', input.projectSlug)
        .maybeSingle();

      if (!concurrentProject) {
        throw new Error(`Could not create the project record: ${createProjectError?.message || 'unknown database error'}`);
      }
      project = concurrentProject;
    }

    const allowedEmails = Array.isArray(legacyProject.allowed_emails) ? legacyProject.allowed_emails : [];
    if (allowedEmails.length > 0) {
      const { error: memberError } = await supabase.from('project_members').upsert(
        allowedEmails.map((email) => ({ project_id: project!.id, email: String(email).trim().toLowerCase(), role: 'client' })),
        { onConflict: 'project_id,email' },
      );
      if (memberError) {
        console.error('[Design Studio] could not import legacy client access:', memberError.message);
      }
    }
  }

  if (!project) throw new Error('Project could not be resolved.');

  if (input.spaceId) {
    const { data: space } = await supabase
      .from('project_spaces')
      .select('id')
      .eq('id', input.spaceId)
      .eq('project_id', project.id)
      .maybeSingle();
    if (!space) throw new Error('Selected space does not belong to this project.');
  }

  const payload = {
    project_id: project.id,
    project_space_id: input.spaceId || null,
    name,
    design_type: 'scratch',
    canvas_width: 760,
    canvas_height: 520,
    elements: input.elements,
    status: 'draft',
    updated_at: new Date().toISOString(),
  };

  let saved;
  if (input.designId) {
    const { data: current } = await supabase
      .from('design_concepts')
      .select('version')
      .eq('id', input.designId)
      .eq('project_id', project.id)
      .maybeSingle();

    const { data, error } = await supabase
      .from('design_concepts')
      .update({ ...payload, version: (current?.version ?? 1) + 1 })
      .eq('id', input.designId)
      .eq('project_id', project.id)
      .select('id, name, version, updated_at')
      .single();
    if (error || !data) throw new Error(`Could not update the design: ${error?.message || 'design not found'}`);
    saved = data;
  } else {
    const { data, error } = await supabase
      .from('design_concepts')
      .insert({ ...payload, created_by_email: 'admin' })
      .select('id, name, version, updated_at')
      .single();
    if (error || !data) throw new Error(`Could not save the design: ${error?.message || 'unknown database error'}`);
    saved = data;
  }

  await supabase.from('project_events').insert({
    project_id: project.id,
    event_type: input.designId ? 'design_concept_updated' : 'design_concept_created',
    metadata: { design_id: saved.id, design_type: 'scratch', name },
  });

  revalidatePath(`/admin-dashboard/${project.slug}/edit`);
  revalidatePath(`/${project.slug}`);
  revalidatePath('/admin-dashboard');
  return saved;
}
