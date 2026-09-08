'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { buildNegativePrompt, buildVisualisationPrompt } from '@/lib/visualisation';

export async function createVisualisationBrief(input: {
  projectSlug: string;
  name: string;
  spaceId?: string | null;
  moodboardId?: string | null;
  designConceptId?: string | null;
  sourceAssetId?: string | null;
}) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error('A visualisation name is required.');
  const supabase = createAdminClient();

  const { data: project, error: projectError } = await supabase.from('projects').select('id, slug').eq('slug', input.projectSlug).maybeSingle();
  if (projectError || !project) throw new Error(`Could not load project: ${projectError?.message || 'project not found'}`);

  let space: any = null;
  if (input.spaceId) {
    const { data, error } = await supabase.from('project_spaces').select('id, name, space_type').eq('id', input.spaceId).eq('project_id', project.id).maybeSingle();
    if (error || !data) throw new Error(`Could not load space: ${error?.message || 'space not found'}`);
    space = data;
  }

  let moodboard: any = null;
  if (input.moodboardId) {
    const { data, error } = await supabase.from('moodboards').select('id, name, project_space_id, style_direction, palette, description, notes').eq('id', input.moodboardId).eq('project_id', project.id).maybeSingle();
    if (error || !data) throw new Error(`Could not load moodboard: ${error?.message || 'moodboard not found'}`);
    moodboard = data;
  }

  let design: any = null;
  if (input.designConceptId) {
    const { data, error } = await supabase.from('design_concepts').select('id, name, project_space_id, elements').eq('id', input.designConceptId).eq('project_id', project.id).maybeSingle();
    if (error || !data) throw new Error(`Could not load design concept: ${error?.message || 'concept not found'}`);
    design = data;
  }

  let sourceAsset: any = null;
  if (input.sourceAssetId) {
    const { data, error } = await supabase.from('project_assets').select('id, space_id, kind, alt_text, storage_path').eq('id', input.sourceAssetId).eq('project_id', project.id).maybeSingle();
    if (error || !data) throw new Error(`Could not load source image: ${error?.message || 'asset not found'}`);
    sourceAsset = data;
  }

  const moodboardItems = moodboard
    ? (await supabase.from('moodboard_items').select('title, category, notes').eq('moodboard_id', moodboard.id).order('sort_order')).data ?? []
    : [];

  const prompt = buildVisualisationPrompt({
    spaceName: space?.name || 'the project space',
    spaceType: space?.space_type,
    direction: moodboard?.style_direction || 'Modern',
    palette: Array.isArray(moodboard?.palette) ? moodboard.palette : [],
    moodboardDescription: moodboard?.description,
    moodboardNotes: moodboard?.notes,
    materialReferences: moodboardItems.map((item: any) => [item.title, item.category, item.notes].filter(Boolean).join(' — ')),
    designElements: Array.isArray(design?.elements) ? design.elements : [],
  });

  const metadata = {
    source: 'kota-visualisation-studio',
    direction: moodboard?.style_direction || 'Modern',
    palette: Array.isArray(moodboard?.palette) ? moodboard.palette : [],
    moodboard_name: moodboard?.name || null,
    design_name: design?.name || null,
    source_asset_id: sourceAsset?.id || null,
  };

  const { data: visualisation, error } = await supabase.from('visualisations').insert({
    project_id: project.id,
    project_space_id: space?.id || null,
    moodboard_id: moodboard?.id || null,
    design_concept_id: design?.id || null,
    source_asset_id: sourceAsset?.id || null,
    name,
    prompt,
    negative_prompt: buildNegativePrompt(),
    status: 'brief',
    provider: process.env.VISUALISATION_PROVIDER || null,
    metadata,
  }).select('id, name, status, created_at').single();

  if (error || !visualisation) throw new Error(`Could not save visualisation brief: ${error?.message || 'unknown database error'}`);

  await supabase.from('project_events').insert({ project_id: project.id, event_type: 'visualisation_brief_created', actor_email: 'admin', metadata: { visualisation_id: visualisation.id, space_id: space?.id || null, moodboard_id: moodboard?.id || null, design_concept_id: design?.id || null } });
  revalidatePath(`/admin-dashboard/${project.slug}/edit`);
  revalidatePath(`/admin-dashboard/${project.slug}/visualise`);
  return visualisation;
}
