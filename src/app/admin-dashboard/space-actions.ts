'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

export type SpaceMeasurements = {
  length_m?: number | null;
  width_m?: number | null;
  height_m?: number | null;
  floor_area_m2?: number | null;
  notes?: string | null;
};

function cleanMeasurement(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > 1000) throw new Error('Measurements must be valid non-negative numbers.');
  return value;
}

export async function updateSpace(input: {
  projectId: string;
  spaceId: string;
  name: string;
  spaceType: string;
  existingNotes?: string;
  measurements: SpaceMeasurements;
}) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error('Space name is required.');
  const measurements = {
    length_m: cleanMeasurement(input.measurements.length_m),
    width_m: cleanMeasurement(input.measurements.width_m),
    height_m: cleanMeasurement(input.measurements.height_m),
    floor_area_m2: cleanMeasurement(input.measurements.floor_area_m2),
    notes: input.measurements.notes?.trim() || null,
  };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('project_spaces')
    .update({
      name,
      space_type: input.spaceType.trim() || 'other',
      existing_notes: input.existingNotes?.trim() || null,
      measurements,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.spaceId)
    .eq('project_id', input.projectId)
    .select('id, name, space_type, existing_notes, measurements')
    .single();
  if (error || !data) throw new Error(`Could not update space: ${error?.message || 'space not found'}`);
  await supabase.from('project_events').insert({
    project_id: input.projectId,
    event_type: 'space_updated',
    actor_email: 'admin',
    metadata: { space_id: input.spaceId },
  });
  const { data: project } = await supabase.from('projects').select('slug').eq('id', input.projectId).maybeSingle();
  if (project?.slug) {
    revalidatePath(`/admin-dashboard/${project.slug}/edit`);
    revalidatePath(`/admin-dashboard/${project.slug}/visualise`);
    revalidatePath('/admin-dashboard');
  }
  return data;
}
