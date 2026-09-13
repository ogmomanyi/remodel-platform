'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { generateVisualisation } from '@/lib/visualisation-provider';
import {
  buildBriefConstrainedPrompt,
  buildBriefNegativePrompt,
  type StructuredVisualisationBrief,
} from '@/lib/visualisation-brief';

type FidelityMode = 'concept' | 'site_accurate';

type SpaceRecord = {
  id: string;
  name: string;
  space_type: string;
  existing_notes: string | null;
  measurements: Record<string, unknown> | null;
};

type MoodboardRecord = {
  id: string;
  name: string;
  project_space_id: string | null;
  style_direction: string | null;
  palette: unknown;
  description: string | null;
  notes: string | null;
};

type DesignRecord = {
  id: string;
  name: string;
  project_space_id: string | null;
  elements: unknown;
};

type SourceAssetRecord = {
  id: string;
  space_id: string | null;
  kind: string;
  alt_text: string | null;
  storage_path: string;
};

type MoodboardItemRecord = {
  title: string;
  category: string;
  notes: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildNonNegotiables(
  projectDescription: string | null,
  space: SpaceRecord | null,
  fidelityMode: FidelityMode,
) {
  const measurements = asRecord(space?.measurements);
  const constraints = [
    projectDescription ? 'Follow the project brief exactly; do not substitute a generic design.' : null,
    space?.existing_notes ? 'Preserve all existing conditions not explicitly identified for alteration.' : null,
    textValue(measurements.site_constraint),
    textValue(measurements.topology_rule),
    textValue(measurements.sketch_relationship),
    textValue(measurements.sketch_glazing),
    textValue(measurements.sketch_fireplace),
    textValue(measurements.sketch_garden_access),
    textValue(measurements.sketch_planter),
    textValue(measurements.sketch_door_shift),
    textValue(measurements.sketch_old_opening),
    measurements.boundary_wall_height_m
      ? 'Garden-facing boundary wall height is ' + String(measurements.boundary_wall_height_m) + ' m.'
      : null,
    measurements.canonical_sketch_zone
      ? 'Respect canonical sketch zone ' + String(measurements.canonical_sketch_zone) + ' and its relationship to adjacent zones.'
      : null,
    fidelityMode === 'site_accurate'
      ? 'Preserve the supplied reference image perspective and permanent architecture. Only alter the scope identified in this brief.'
      : 'This is concept mode; do not present inferred geometry as surveyed fact.',
  ].filter((item): item is string => Boolean(item));

  return Array.from(new Set(constraints));
}

export async function createVisualisationBrief(input: {
  projectSlug: string;
  name: string;
  spaceId?: string | null;
  moodboardId?: string | null;
  designConceptId?: string | null;
  sourceAssetId?: string | null;
  fidelityMode?: FidelityMode;
}) {
  await requireAdmin();

  const name = input.name.trim();
  if (!name) throw new Error('A visualisation name is required.');

  const fidelityMode: FidelityMode = input.fidelityMode === 'concept' ? 'concept' : 'site_accurate';
  if (fidelityMode === 'site_accurate' && !input.sourceAssetId) {
    throw new Error('Site-accurate mode requires an existing site photo. Upload and select a reference image first, or switch to Concept mode.');
  }

  const supabase = createAdminClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, slug, project_code, client_name, description')
    .eq('slug', input.projectSlug)
    .maybeSingle();

  if (projectError || !project) {
    throw new Error('Could not load project: ' + (projectError?.message || 'project not found'));
  }

  let space: SpaceRecord | null = null;
  if (input.spaceId) {
    const { data, error } = await supabase
      .from('project_spaces')
      .select('id, name, space_type, existing_notes, measurements')
      .eq('id', input.spaceId)
      .eq('project_id', project.id)
      .maybeSingle();
    if (error || !data) throw new Error('Could not load space: ' + (error?.message || 'space not found'));
    space = {
      ...data,
      measurements: asRecord(data.measurements),
    };
  }

  let moodboard: MoodboardRecord | null = null;
  if (input.moodboardId) {
    const { data, error } = await supabase
      .from('moodboards')
      .select('id, name, project_space_id, style_direction, palette, description, notes')
      .eq('id', input.moodboardId)
      .eq('project_id', project.id)
      .maybeSingle();
    if (error || !data) throw new Error('Could not load moodboard: ' + (error?.message || 'moodboard not found'));
    if (space && data.project_space_id && data.project_space_id !== space.id) {
      throw new Error('Selected moodboard belongs to a different project space.');
    }
    moodboard = data;
  }

  let design: DesignRecord | null = null;
  if (input.designConceptId) {
    const { data, error } = await supabase
      .from('design_concepts')
      .select('id, name, project_space_id, elements')
      .eq('id', input.designConceptId)
      .eq('project_id', project.id)
      .maybeSingle();
    if (error || !data) throw new Error('Could not load design concept: ' + (error?.message || 'concept not found'));
    if (space && data.project_space_id && data.project_space_id !== space.id) {
      throw new Error('Selected spatial concept belongs to a different project space.');
    }
    design = data;
  }

  let sourceAsset: SourceAssetRecord | null = null;
  if (input.sourceAssetId) {
    const { data, error } = await supabase
      .from('project_assets')
      .select('id, space_id, kind, alt_text, storage_path')
      .eq('id', input.sourceAssetId)
      .eq('project_id', project.id)
      .maybeSingle();
    if (error || !data) throw new Error('Could not load source image: ' + (error?.message || 'asset not found'));
    if (data.kind !== 'site_photo') throw new Error('Site-accurate mode requires a site photo, not a generated render or other asset.');
    if (space && data.space_id && data.space_id !== space.id) {
      throw new Error('Selected source photo belongs to a different project space.');
    }
    sourceAsset = data;
  }

  const [{ data: options }, { data: boardItems }] = await Promise.all([
    space
      ? supabase
          .from('design_options')
          .select('name, description, materials, is_recommended, sort_order')
          .eq('space_id', space.id)
          .eq('is_recommended', true)
          .order('sort_order')
      : Promise.resolve({ data: [] }),
    moodboard
      ? supabase
          .from('moodboard_items')
          .select('title, category, notes')
          .eq('moodboard_id', moodboard.id)
          .order('sort_order')
      : Promise.resolve({ data: [] }),
  ]);

  const measurements = asRecord(space?.measurements);
  const brief: StructuredVisualisationBrief = {
    version: 3,
    fidelityMode,
    project: {
      code: project.project_code,
      clientName: project.client_name,
      description: project.description,
    },
    space: space
      ? {
          id: space.id,
          name: space.name,
          type: space.space_type,
          existingNotes: space.existing_notes,
          measurements,
        }
      : null,
    topology: {
      canonicalFiveZone: Boolean(measurements.canonical_sketch_zone),
      zone: textValue(measurements.canonical_sketch_zone),
      sketchPosition: textValue(measurements.sketch_position),
      topologyRule: textValue(measurements.topology_rule),
    },
    designOptions: (options ?? []).map((option) => ({
      name: option.name,
      description: option.description,
      materials: Array.isArray(option.materials) ? option.materials : [],
    })),
    moodboard: moodboard
      ? {
          name: moodboard.name,
          direction: moodboard.style_direction,
          palette: Array.isArray(moodboard.palette) ? moodboard.palette.filter((item): item is string => typeof item === 'string') : [],
          description: moodboard.description,
          notes: moodboard.notes,
          references: (boardItems as MoodboardItemRecord[] ?? []).map((item) =>
            [item.title, item.category, item.notes].filter(Boolean).join(' — '),
          ),
        }
      : null,
    spatialConcept: design
      ? {
          name: design.name,
          elements: Array.isArray(design.elements) ? design.elements : [],
        }
      : null,
    sourceReference: sourceAsset
      ? {
          id: sourceAsset.id,
          caption: sourceAsset.alt_text,
          kind: sourceAsset.kind,
        }
      : null,
    nonNegotiables: buildNonNegotiables(project.description, space, fidelityMode),
  };

  const prompt = buildBriefConstrainedPrompt(brief);
  const metadata = {
    source: 'kota-visualisation-studio',
    project_slug: project.slug,
    brief_version: 3,
    fidelity_mode: fidelityMode,
    constraint_count: brief.nonNegotiables.length,
    source_asset_id: sourceAsset?.id || null,
    moodboard_name: moodboard?.name || null,
    design_name: design?.name || null,
  };

  const { data: visualisation, error } = await supabase
    .from('visualisations')
    .insert({
      project_id: project.id,
      project_space_id: space?.id || null,
      moodboard_id: moodboard?.id || null,
      design_concept_id: design?.id || null,
      source_asset_id: sourceAsset?.id || null,
      name,
      prompt,
      negative_prompt: buildBriefNegativePrompt(),
      status: 'brief',
      provider: process.env.VISUALISATION_PROVIDER || 'pollinations',
      metadata,
      fidelity_mode: fidelityMode,
      brief_json: brief,
      brief_version: 3,
      requires_source_asset: fidelityMode === 'site_accurate',
    })
    .select('id, name, status, project_space_id, moodboard_id, source_asset_id, output_asset_id, variant_key, is_selected, fidelity_mode, brief_version, created_at')
    .single();

  if (error || !visualisation) {
    throw new Error('Could not save visualisation brief: ' + (error?.message || 'unknown database error'));
  }

  await supabase.from('project_events').insert({
    project_id: project.id,
    event_type: 'visualisation_brief_created',
    actor_email: 'admin',
    metadata: {
      visualisation_id: visualisation.id,
      fidelity_mode: fidelityMode,
      brief_version: 3,
    },
  });

  // Keep the dedicated visualisation route fresh; the client adds the created
  // brief locally so the heavyweight Design Studio page does not need to reload.
  revalidatePath('/admin-dashboard/' + project.slug + '/visualise');
  return visualisation;
}

export async function renderVisualisation(input: { visualisationId: string; variantKey?: string }) {
  await requireAdmin();
  const supabase = createAdminClient();
  const variantKey = (input.variantKey || 'primary')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .slice(0, 40) || 'primary';

  const { data: job, error } = await supabase
    .from('visualisations')
    .select('id, project_id, project_space_id, name, prompt, negative_prompt, source_asset_id, metadata, fidelity_mode, requires_source_asset, brief_version')
    .eq('id', input.visualisationId)
    .maybeSingle();

  if (error || !job) throw new Error('Could not load visualisation: ' + (error?.message || 'not found'));

  if (job.requires_source_asset && !job.source_asset_id) {
    throw new Error('This is a site-accurate brief and cannot render without its source site photo.');
  }

  const variantPrompt = [
    job.prompt,
    '',
    'VARIANT INSTRUCTION: ' + variantKey + '.',
    'Do not relax or reinterpret any non-negotiable project constraint for the sake of styling.',
    'Any variation must be limited to lighting, furnishings, material nuance and photographic composition that do not change the architecture.',
  ].join('\\n');

  await supabase
    .from('visualisations')
    .update({ status: 'generating', variant_key: variantKey, updated_at: new Date().toISOString() })
    .eq('id', job.id);

  try {
    let sourcePath: string | null = null;
    if (job.source_asset_id) {
      const { data: source, error: sourceError } = await supabase
        .from('project_assets')
        .select('storage_path, kind')
        .eq('id', job.source_asset_id)
        .maybeSingle();

      if (sourceError || !source?.storage_path) {
        throw new Error('The required source site photo is no longer available. Re-upload/select the site photo before rendering.');
      }
      if (source.kind !== 'site_photo') {
        throw new Error('The selected source reference is not a site photo.');
      }
      sourcePath = source.storage_path;
    }

    const result = await generateVisualisation({
      prompt: variantPrompt,
      negativePrompt: job.negative_prompt,
      sourceAssetStoragePath: sourcePath,
    });

    const ext = result.contentType.includes('png') ? 'png' : 'jpg';
    const storagePath = job.project_id + '/visualisations/' + job.id + '-' + variantKey + '.' + ext;

    const { error: uploadError } = await supabase.storage
      .from('project-assets')
      .upload(storagePath, result.bytes, { contentType: result.contentType, upsert: true });

    if (uploadError) throw new Error('Could not save generated visualisation: ' + uploadError.message);

    const model = sourcePath
      ? (process.env.POLLINATIONS_EDIT_MODEL || 'klein')
      : (process.env.POLLINATIONS_MODEL || 'flux');

    const { data: asset, error: assetError } = await supabase
      .from('project_assets')
      .insert({
        project_id: job.project_id,
        space_id: job.project_space_id,
        kind: 'render',
        storage_path: storagePath,
        alt_text: job.name + ' — ' + variantKey,
        metadata: {
          visualisation_id: job.id,
          provider: 'pollinations',
          variant_key: variantKey,
          model,
          fidelity_mode: job.fidelity_mode,
          brief_version: job.brief_version,
        },
      })
      .select('id')
      .single();

    if (assetError || !asset) {
      throw new Error('Could not create render asset: ' + (assetError?.message || 'unknown error'));
    }

    const { error: variantError } = await supabase
      .from('visualisation_variants')
      .upsert({
        visualisation_id: job.id,
        asset_id: asset.id,
        variant_key: variantKey,
        prompt: variantPrompt,
        provider: 'pollinations',
        model,
      }, { onConflict: 'visualisation_id,variant_key' });

    if (variantError) throw new Error('Could not save render variant history: ' + variantError.message);

    const nextMetadata = {
      ...asRecord(job.metadata),
      rendered_at: new Date().toISOString(),
      output_asset_id: asset.id,
      fidelity_mode: job.fidelity_mode,
      brief_version: job.brief_version,
    };

    await supabase
      .from('visualisations')
      .update({
        status: 'ready',
        output_asset_id: asset.id,
        variant_key: variantKey,
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    await supabase.from('project_events').insert({
      project_id: job.project_id,
      event_type: 'visualisation_rendered',
      actor_email: 'admin',
      metadata: {
        visualisation_id: job.id,
        asset_id: asset.id,
        provider: 'pollinations',
        variant_key: variantKey,
        fidelity_mode: job.fidelity_mode,
      },
    });

    const projectSlug = textValue(asRecord(job.metadata).project_slug) || '';
    if (projectSlug) revalidatePath('/admin-dashboard/' + projectSlug + '/visualise');

    return { id: job.id, assetId: asset.id, status: 'ready' as const, variantKey };
  } catch (renderError) {
    await supabase
      .from('visualisations')
      .update({
        status: 'failed',
        metadata: {
          ...asRecord(job.metadata),
          error: renderError instanceof Error ? renderError.message : 'Unknown error',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    throw renderError;
  }
}

export async function selectVisualisationVariant(input: { visualisationId: string }) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: job, error } = await supabase
    .from('visualisations')
    .select('id, project_id, project_space_id, output_asset_id, variant_key, metadata')
    .eq('id', input.visualisationId)
    .maybeSingle();

  if (error || !job || !job.output_asset_id) {
    throw new Error('A completed visualisation render is required before selecting it.');
  }

  await supabase
    .from('visualisation_variants')
    .update({ is_selected: false })
    .eq('visualisation_id', job.id)
    .eq('is_selected', true);

  await supabase
    .from('visualisation_variants')
    .update({ is_selected: true })
    .eq('visualisation_id', job.id)
    .eq('variant_key', job.variant_key || 'primary');

  if (job.project_space_id) {
    await supabase
      .from('visualisations')
      .update({ is_selected: false })
      .eq('project_space_id', job.project_space_id)
      .eq('is_selected', true);
  }

  await supabase
    .from('visualisations')
    .update({ is_selected: true, updated_at: new Date().toISOString() })
    .eq('id', job.id);

  await supabase.from('project_events').insert({
    project_id: job.project_id,
    event_type: 'visualisation_selected',
    actor_email: 'admin',
    metadata: {
      visualisation_id: job.id,
      asset_id: job.output_asset_id,
      variant_key: job.variant_key || 'primary',
    },
  });

  const slug = textValue(asRecord(job.metadata).project_slug) || '';
  if (slug) {
    revalidatePath('/admin-dashboard/' + slug + '/visualise');
    revalidatePath('/admin-dashboard/' + slug + '/edit');
  }

  return { id: job.id, selected: true };
}
