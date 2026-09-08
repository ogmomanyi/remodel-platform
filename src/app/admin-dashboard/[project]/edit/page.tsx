import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { getProjectBySlug } from '@/lib/projects';
import { createAdminClient } from '@/utils/supabase/admin';
import { DesignStudioActions } from '@/components/admin/DesignStudioActions';
import { ScratchDesignStudioV2 } from '@/components/admin/ScratchDesignStudioV2';
import { SpaceManager } from '@/components/admin/SpaceManager';
import { ProjectAssetManager } from '@/components/admin/ProjectAssetManager';
import MoodboardStudio from '@/components/admin/MoodboardStudio';
import VisualisationStudio from '@/components/admin/VisualisationStudio';

type DesignElement = { id: string; type: string; x: number; y: number; width: number; height: number; rotation: number; label?: string; finish?: string; accent?: string; material?: string };
type Space = { id: string; name: string; space_type: string; existing_notes: string | null; options: Array<{ id: string; name: string; description: string | null; cost_estimate: number | null; currency: string; status: string; is_recommended: boolean }> };
type Asset = { id: string; space_id: string | null; kind: string; storage_path: string; alt_text: string | null; created_at: string; signed_url?: string | null };

export default async function DesignStudioPage({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin();
  const { project: slug } = await params;
  const legacyProject = getProjectBySlug(slug);
  const supabase = createAdminClient();
  const { data: dbProject } = await supabase.from('projects').select('id, slug, project_code, client_name, description, status').eq('slug', slug).maybeSingle();
  if (!legacyProject && !dbProject) notFound();
  const project = dbProject ? { id: dbProject.id, slug: dbProject.slug, client_name: dbProject.client_name, project_code: dbProject.project_code, status: dbProject.status, allowed_emails: [] as string[], materials_required: [] as string[], description: dbProject.description || '' } : { id: null, slug: legacyProject!.slug, client_name: legacyProject!.client_name, project_code: legacyProject!.project_code, status: legacyProject!.status, allowed_emails: legacyProject!.allowed_emails, materials_required: legacyProject!.materials_required, description: String(legacyProject!.frontmatter.description || '') };
  let emails = project.allowed_emails;
  let spaces: Space[] = [];
  let designs: Array<{ id: string; name: string; elements: DesignElement[]; version: number; updated_at: string; space_id?: string | null }> = [];
  let assets: Asset[] = [];
  let moodboards: Array<{ id: string; name: string; project_space_id: string | null; style_direction: string; palette: string[]; description: string | null; notes: string | null; updated_at: string }> = [];
  let visualBriefs: Array<{ id: string; name: string; prompt: string; negative_prompt: string | null; status: string; project_space_id: string | null }> = [];
  if (dbProject) {
    const [{ data: members }, { data: dbSpaces }, { data: dbDesigns }, { data: dbAssets }, { data: dbMoodboards }, { data: dbVisualisations }] = await Promise.all([
      supabase.from('project_members').select('email').eq('project_id', dbProject.id),
      supabase.from('project_spaces').select('id, name, space_type, existing_notes').eq('project_id', dbProject.id).order('sort_order'),
      supabase.from('design_concepts').select('id, name, elements, version, updated_at, project_space_id').eq('project_id', dbProject.id).eq('design_type', 'scratch').order('updated_at', { ascending: false }),
      supabase.from('project_assets').select('id, space_id, kind, storage_path, alt_text, created_at').eq('project_id', dbProject.id).order('created_at', { ascending: false }),
      supabase.from('moodboards').select('id, name, project_space_id, style_direction, palette, description, notes, updated_at').eq('project_id', dbProject.id).order('updated_at', { ascending: false }),
      supabase.from('visualisations').select('id, name, prompt, negative_prompt, status, project_space_id').eq('project_id', dbProject.id).order('updated_at', { ascending: false }),
    ]);
    emails = (members ?? []).map(m => m.email);
    const spaceIds = (dbSpaces ?? []).map(s => s.id);
    const { data: options } = spaceIds.length ? await supabase.from('design_options').select('id, space_id, name, description, cost_estimate, currency, status, is_recommended').in('space_id', spaceIds).order('sort_order') : { data: [] };
    spaces = (dbSpaces ?? []).map(s => ({ ...s, options: (options ?? []).filter(o => o.space_id === s.id).map(({ space_id, ...o }) => o) }));
    designs = (dbDesigns ?? []).map(d => ({ id: d.id, name: d.name, elements: Array.isArray(d.elements) ? d.elements as DesignElement[] : [], version: d.version, updated_at: d.updated_at, space_id: d.project_space_id }));
    moodboards = (dbMoodboards ?? []).map(b => ({ ...b, palette: Array.isArray(b.palette) ? b.palette as string[] : [] }));
    visualBriefs = (dbVisualisations ?? []).map(v => v);
    assets = await Promise.all((dbAssets ?? []).map(async (asset) => { const { data } = await supabase.storage.from('project-assets').createSignedUrl(asset.storage_path, 60 * 60); return { ...asset, signed_url: data?.signedUrl ?? null }; }));
  }
  const latestBrief = visualBriefs[0] ?? null;
  return <main className="min-h-screen bg-slate-100 p-6 md:p-8"><div className="max-w-7xl mx-auto"><div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7"><div><Link href="/admin-dashboard" className="text-sm text-slate-600 hover:text-black">← Dashboard</Link><p className="text-xs uppercase tracking-wider text-slate-500 mt-4">Design Studio</p><h1 className="text-3xl font-bold text-gray-900 mt-1">{project.client_name}</h1><p className="font-mono text-sm text-slate-500 mt-2">{project.project_code}</p></div><div className="flex gap-2"><Link href="/admin-dashboard/clients" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium">Manage client access</Link><Link href={legacyProject ? `/${project.slug}` : `/client-login?next=/${project.slug}`} target="_blank" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium">Preview ↗</Link></div></div><div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><section className="lg:col-span-2 space-y-6"><div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="text-lg font-semibold">Project brief</h2><p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{project.description || 'Add the project vision and scope.'}</p></div>{project.id ? <MoodboardStudio projectSlug={project.slug} spaces={spaces.map(({ id, name, space_type }) => ({ id, name, space_type }))} assets={assets} initialBoard={moodboards[0] ? { ...moodboards[0], items: [] } : null} /> : null}{project.id ? <VisualisationStudio projectSlug={project.slug} spaces={spaces.map(({ id, name }) => ({ id, name }))} moodboards={moodboards} designs={designs.map(({ id, name, space_id }) => ({ id, name, space_id }))} assets={assets} initialBrief={latestBrief} /> : null}{project.id ? <ScratchDesignStudioV2 projectSlug={project.slug} initialDesigns={designs} spaces={spaces.map(({ id, name }) => ({ id, name }))} /> : <div className="bg-white rounded-xl border border-amber-200 p-6 text-sm text-amber-800">Save a scratch concept once to promote this legacy project into the editable Studio database.</div>}{project.id ? <SpaceManager projectId={project.id} initialSpaces={spaces} /> : <div className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-500">Spaces become editable after this legacy project is promoted.</div>}{project.id && <ProjectAssetManager projectId={project.id} spaces={spaces.map(({ id, name }) => ({ id, name }))} initialAssets={assets} />}<DesignStudioActions projectSlug={project.slug} /></section><aside className="space-y-6"><div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="font-semibold">Project status</h2><div className="mt-4 text-sm text-slate-600">Current: <strong>{project.status}</strong></div><div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full w-1/4 bg-slate-900 rounded-full" /></div><p className="text-xs text-slate-500 mt-2">Brief → Design → Visualise → Presentation → Approval → Execution</p></div><div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="font-semibold">Client access</h2><p className="text-sm text-slate-500 mt-2">Authorised emails</p><ul className="mt-3 space-y-2">{emails.length ? emails.map(e => <li key={e} className="text-sm break-all">{e}</li>) : <li className="text-sm text-amber-600">No client email configured yet.</li>}</ul></div><div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="font-semibold">Materials</h2><p className="text-sm text-slate-500 mt-2">{project.materials_required.length} material requirement(s)</p>{project.materials_required.length > 0 && <ul className="mt-3 text-sm text-slate-700 list-disc pl-5">{project.materials_required.map(item => <li key={item}>{item}</li>)}</ul>}</div></aside></div></div></main>;
}
