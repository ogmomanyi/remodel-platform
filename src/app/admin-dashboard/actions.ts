'use server';

import { revalidatePath } from 'next/cache';
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
};

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
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, slug')
    .eq('slug', input.projectSlug)
    .single();

  if (projectError || !project) throw new Error('Project not found.');

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
    const { data, error } = await supabase
      .from('design_concepts')
      .update(payload)
      .eq('id', input.designId)
      .eq('project_id', project.id)
      .select('id, name, version, updated_at')
      .single();
    if (error || !data) throw new Error('Could not update the design.');
    saved = data;
  } else {
    const { data, error } = await supabase
      .from('design_concepts')
      .insert(payload)
      .select('id, name, version, updated_at')
      .single();
    if (error || !data) throw new Error('Could not save the design.');
    saved = data;
  }

  await supabase.from('project_events').insert({
    project_id: project.id,
    event_type: input.designId ? 'design_concept_updated' : 'design_concept_created',
    metadata: { design_id: saved.id, design_type: 'scratch', name },
  });

  revalidatePath(`/admin-dashboard/${project.slug}/edit`);
  revalidatePath(`/${project.slug}`);
  return saved;
}
