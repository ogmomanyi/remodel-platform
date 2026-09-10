'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { buildNegativePrompt, buildVisualisationPrompt } from '@/lib/visualisation';
import { generateVisualisation } from '@/lib/visualisation-provider';

export async function createVisualisationBrief(input: { projectSlug: string; name: string; spaceId?: string | null; moodboardId?: string | null; designConceptId?: string | null; sourceAssetId?: string | null }) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error('A visualisation name is required.');
  const supabase = createAdminClient();
  const { data: project, error: projectError } = await supabase.from('projects').select('id, slug').eq('slug', input.projectSlug).maybeSingle();
  if (projectError || !project) throw new Error(`Could not load project: ${projectError?.message || 'project not found'}`);
  let space: any = null;
  if (input.spaceId) { const { data, error } = await supabase.from('project_spaces').select('id, name, space_type').eq('id', input.spaceId).eq('project_id', project.id).maybeSingle(); if (error || !data) throw new Error(`Could not load space: ${error?.message || 'space not found'}`); space = data; }
  let moodboard: any = null;
  if (input.moodboardId) { const { data, error } = await supabase.from('moodboards').select('id, name, project_space_id, style_direction, palette, description, notes').eq('id', input.moodboardId).eq('project_id', project.id).maybeSingle(); if (error || !data) throw new Error(`Could not load moodboard: ${error?.message || 'moodboard not found'}`); moodboard = data; }
  let design: any = null;
  if (input.designConceptId) { const { data, error } = await supabase.from('design_concepts').select('id, name, project_space_id, elements').eq('id', input.designConceptId).eq('project_id', project.id).maybeSingle(); if (error || !data) throw new Error(`Could not load design concept: ${error?.message || 'concept not found'}`); design = data; }
  let sourceAsset: any = null;
  if (input.sourceAssetId) { const { data, error } = await supabase.from('project_assets').select('id, space_id, kind, alt_text, storage_path').eq('id', input.sourceAssetId).eq('project_id', project.id).maybeSingle(); if (error || !data) throw new Error(`Could not load source image: ${error?.message || 'asset not found'}`); sourceAsset = data; }
  const moodboardItems = moodboard ? (await supabase.from('moodboard_items').select('title, category, notes').eq('moodboard_id', moodboard.id).order('sort_order')).data ?? [] : [];
  const prompt = buildVisualisationPrompt({ spaceName: space?.name || 'the project space', spaceType: space?.space_type, direction: moodboard?.style_direction || 'Modern', palette: Array.isArray(moodboard?.palette) ? moodboard.palette : [], moodboardDescription: moodboard?.description, moodboardNotes: moodboard?.notes, materialReferences: moodboardItems.map((item: any) => [item.title, item.category, item.notes].filter(Boolean).join(' — ')), designElements: Array.isArray(design?.elements) ? design.elements : [] });
  const metadata = { source: 'kota-visualisation-studio', direction: moodboard?.style_direction || 'Modern', palette: Array.isArray(moodboard?.palette) ? moodboard.palette : [], moodboard_name: moodboard?.name || null, design_name: design?.name || null, source_asset_id: sourceAsset?.id || null, project_slug: project.slug };
  const { data: visualisation, error } = await supabase.from('visualisations').insert({ project_id: project.id, project_space_id: space?.id || null, moodboard_id: moodboard?.id || null, design_concept_id: design?.id || null, source_asset_id: sourceAsset?.id || null, name, prompt, negative_prompt: buildNegativePrompt(), status: 'brief', provider: process.env.VISUALISATION_PROVIDER || 'pollinations', metadata }).select('id, name, status, created_at').single();
  if (error || !visualisation) throw new Error(`Could not save visualisation brief: ${error?.message || 'unknown database error'}`);
  await supabase.from('project_events').insert({ project_id: project.id, event_type: 'visualisation_brief_created', actor_email: 'admin', metadata: { visualisation_id: visualisation.id } });
  revalidatePath(`/admin-dashboard/${project.slug}/edit`); revalidatePath(`/admin-dashboard/${project.slug}/visualise`);
  return visualisation;
}

export async function renderVisualisation(input: { visualisationId: string; variantKey?: string }) {
  await requireAdmin();
  const supabase = createAdminClient();
  const variantKey = (input.variantKey || 'primary').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 40) || 'primary';
  const { data: job, error } = await supabase.from('visualisations').select('id, project_id, project_space_id, name, prompt, negative_prompt, source_asset_id, metadata').eq('id', input.visualisationId).maybeSingle();
  if (error || !job) throw new Error(`Could not load visualisation: ${error?.message || 'not found'}`);

  const variantPrompt = `${job.prompt}\n\nRender variant: ${variantKey}. Preserve the room architecture, proportions, openings and design brief. Explore a refined alternative composition and styling while remaining faithful to the specified direction.`;
  await supabase.from('visualisations').update({ status: 'generating', provider: 'pollinations', variant_key: variantKey, updated_at: new Date().toISOString() }).eq('id', job.id);
  try {
    let sourcePath: string | null = null;
    if (job.source_asset_id) {
      const { data: source } = await supabase.from('project_assets').select('storage_path').eq('id', job.source_asset_id).maybeSingle();
      sourcePath = source?.storage_path ?? null;
    }
    const result = await generateVisualisation({ prompt: variantPrompt, negativePrompt: job.negative_prompt, sourceAssetStoragePath: sourcePath });
    const ext = result.contentType.includes('png') ? 'png' : 'jpg';
    const storagePath = `${job.project_id}/visualisations/${job.id}-${variantKey}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('project-assets').upload(storagePath, result.bytes, { contentType: result.contentType, upsert: true });
    if (uploadError) throw new Error(`Could not save generated visualisation: ${uploadError.message}`);
    const { data: asset, error: assetError } = await supabase.from('project_assets').insert({ project_id: job.project_id, space_id: job.project_space_id, kind: 'render', storage_path: storagePath, alt_text: `${job.name} — ${variantKey}`, metadata: { visualisation_id: job.id, provider: 'pollinations', variant_key: variantKey, model: job.source_asset_id ? (process.env.POLLINATIONS_EDIT_MODEL || 'klein') : (process.env.POLLINATIONS_MODEL || 'flux') } }).select('id').single();
    if (assetError || !asset) throw new Error(`Could not create render asset: ${assetError?.message || 'unknown error'}`);
    const nextMetadata = { ...(job.metadata || {}), rendered_at: new Date().toISOString(), output_asset_id: asset.id };
    await supabase.from('visualisations').update({ status: 'ready', output_asset_id: asset.id, variant_key: variantKey, metadata: nextMetadata, updated_at: new Date().toISOString() }).eq('id', job.id);
    await supabase.from('project_events').insert({ project_id: job.project_id, event_type: 'visualisation_rendered', actor_email: 'admin', metadata: { visualisation_id: job.id, asset_id: asset.id, provider: 'pollinations', variant_key: variantKey } });
    const projectSlug = typeof job.metadata?.project_slug === 'string' ? job.metadata.project_slug : '';
    if (projectSlug) { revalidatePath(`/admin-dashboard/${projectSlug}/visualise`); revalidatePath(`/admin-dashboard/${projectSlug}/edit`); }
    return { id: job.id, assetId: asset.id, status: 'ready' as const, variantKey };
  } catch (renderError) {
    await supabase.from('visualisations').update({ status: 'failed', metadata: { ...(job.metadata || {}), error: renderError instanceof Error ? renderError.message : 'Unknown error' }, updated_at: new Date().toISOString() }).eq('id', job.id);
    throw renderError;
  }
}

export async function selectVisualisationVariant(input: { visualisationId: string }) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data: job, error } = await supabase.from('visualisations').select('id, project_id, project_space_id, output_asset_id, metadata').eq('id', input.visualisationId).maybeSingle();
  if (error || !job || !job.output_asset_id) throw new Error('A completed visualisation render is required before selecting it.');
  if (job.project_space_id) await supabase.from('visualisations').update({ is_selected: false }).eq('project_space_id', job.project_space_id).eq('is_selected', true);
  await supabase.from('visualisations').update({ is_selected: true, updated_at: new Date().toISOString() }).eq('id', job.id);
  await supabase.from('project_events').insert({ project_id: job.project_id, event_type: 'visualisation_selected', actor_email: 'admin', metadata: { visualisation_id: job.id, asset_id: job.output_asset_id } });
  const slug = typeof job.metadata?.project_slug === 'string' ? job.metadata.project_slug : '';
  if (slug) { revalidatePath(`/admin-dashboard/${slug}/visualise`); revalidatePath(`/admin-dashboard/${slug}/edit`); }
  return { id: job.id, selected: true };
}
