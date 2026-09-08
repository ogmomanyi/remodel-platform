import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import VisualisationBriefStudio from '@/components/admin/VisualisationBriefStudio';

export default async function VisualisePage({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin();
  const { project: slug } = await params;
  const supabase = createAdminClient();
  const { data: project } = await supabase.from('projects').select('id, slug, project_code, client_name').eq('slug', slug).maybeSingle();
  if (!project) notFound();
  const [{ data: spaces }, { data: moodboards }, { data: concepts }, { data: assets }, { data: visualisations }] = await Promise.all([
    supabase.from('project_spaces').select('id, name, space_type').eq('project_id', project.id).order('sort_order'),
    supabase.from('moodboards').select('id, name, project_space_id, style_direction, palette').eq('project_id', project.id).neq('status', 'archived').order('updated_at', { ascending: false }),
    supabase.from('design_concepts').select('id, name, project_space_id, design_type').eq('project_id', project.id).eq('design_type', 'scratch').order('updated_at', { ascending: false }),
    supabase.from('project_assets').select('id, space_id, kind, alt_text, storage_path').eq('project_id', project.id).order('created_at', { ascending: false }),
    supabase.from('visualisations').select('id, name, status, project_space_id, moodboard_id, design_concept_id, source_asset_id, created_at').eq('project_id', project.id).order('created_at', { ascending: false }),
  ]);

  const signedAssets = await Promise.all((assets ?? []).map(async (asset) => {
    const { data } = await supabase.storage.from('project-assets').createSignedUrl(asset.storage_path, 60 * 60);
    return { ...asset, signed_url: data?.signedUrl ?? null };
  }));

  return <main className="min-h-screen bg-stone-50 px-6 py-10"><div className="mx-auto max-w-7xl">
    <div className="mb-6 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{project.project_code} · {project.client_name}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Visualisation Studio</h1><p className="mt-1 text-sm text-stone-500">Prepare a controlled brief for photorealistic room visualisation.</p></div><Link href={`/admin-dashboard/${slug}/edit`} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700">Back to Design Studio</Link></div>
    <VisualisationBriefStudio projectSlug={slug} spaces={spaces ?? []} moodboards={moodboards ?? []} concepts={concepts ?? []} assets={signedAssets} visualisations={visualisations ?? []} />
  </div></main>;
}
