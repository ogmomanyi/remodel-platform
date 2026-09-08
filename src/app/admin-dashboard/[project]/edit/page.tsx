import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { getProjectBySlug } from '@/lib/projects';
import { createAdminClient } from '@/utils/supabase/admin';
import { DesignStudioActions } from '@/components/admin/DesignStudioActions';
import { ScratchDesignStudio } from '@/components/admin/ScratchDesignStudio';

type DesignElement = { id: string; type: 'room' | 'wall' | 'window' | 'door' | 'sofa' | 'table' | 'plant' | 'text'; x: number; y: number; width: number; height: number; rotation: number; label?: string };

export default async function DesignStudioPage({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin();
  const { project: slug } = await params;
  const legacyProject = getProjectBySlug(slug);
  const supabase = createAdminClient();
  const { data: dbProject } = await supabase.from('projects').select('id, slug, project_code, client_name, description, status').eq('slug', slug).maybeSingle();
  if (!legacyProject && !dbProject) notFound();

  const project = dbProject ? {
    id: dbProject.id, slug: dbProject.slug, client_name: dbProject.client_name, project_code: dbProject.project_code,
    status: dbProject.status, description: dbProject.description || '', allowed_emails: [] as string[], materials_required: [] as string[],
  } : {
    id: null, slug: legacyProject!.slug, client_name: legacyProject!.client_name, project_code: legacyProject!.project_code,
    status: legacyProject!.status, description: String(legacyProject!.frontmatter.description || ''), allowed_emails: legacyProject!.allowed_emails, materials_required: legacyProject!.materials_required,
  };

  let emails = project.allowed_emails;
  let spaces: Array<{ id: string; name: string; space_type: string }> = [];
  let designs: Array<{ id: string; name: string; elements: DesignElement[]; version: number; updated_at: string }> = [];
  if (dbProject) {
    const [{ data: members }, { data: dbSpaces }, { data: dbDesigns }] = await Promise.all([
      supabase.from('project_members').select('email').eq('project_id', dbProject.id),
      supabase.from('project_spaces').select('id, name, space_type').eq('project_id', dbProject.id).order('sort_order'),
      supabase.from('design_concepts').select('id, name, elements, version, updated_at').eq('project_id', dbProject.id).eq('design_type', 'scratch').order('updated_at', { ascending: false }),
    ]);
    emails = (members ?? []).map((member) => member.email);
    spaces = dbSpaces ?? [];
    designs = (dbDesigns ?? []).map((design) => ({ id: design.id, name: design.name, elements: Array.isArray(design.elements) ? design.elements as DesignElement[] : [], version: design.version, updated_at: design.updated_at }));
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7">
          <div><Link href="/admin-dashboard" className="text-sm text-slate-600 hover:text-black">← Dashboard</Link><p className="text-xs uppercase tracking-wider text-slate-500 mt-4">Design Studio</p><h1 className="text-3xl font-bold text-gray-900 mt-1">{project.client_name}</h1><p className="font-mono text-sm text-slate-500 mt-2">{project.project_code}</p></div>
          <Link href={legacyProject ? `/${project.slug}` : `/client-login?next=/${project.slug}`} target="_blank" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium">Preview client presentation ↗</Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="text-lg font-semibold">Project brief</h2><p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{project.description || 'Add the project vision and scope.'}</p></div>
            <ScratchDesignStudio projectSlug={project.slug} initialDesigns={designs} />
            <div className="bg-white rounded-xl border border-gray-200 p-6"><div className="flex items-center justify-between mb-5"><div><h2 className="text-lg font-semibold">Spaces & design options</h2><p className="text-sm text-gray-500 mt-1">Build the renovation area by area.</p></div><span className="text-xs rounded-full bg-slate-100 px-3 py-1">{spaces.length} spaces</span></div>{spaces.length ? <div className="grid sm:grid-cols-2 gap-4">{spaces.map((space) => <div key={space.id} className="rounded-lg border border-gray-200 p-5"><h3 className="font-medium text-gray-900">{space.name}</h3><p className="text-sm text-gray-500 mt-1">{space.space_type}</p></div>)}</div> : <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center"><h3 className="font-medium text-gray-800">No spaces added yet</h3><p className="text-sm text-gray-500 mt-2">Add rooms, patios, verandas and other areas in the next project editor layer.</p></div>}</div>
            <DesignStudioActions projectSlug={project.slug} />
          </section>
          <aside className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="font-semibold">Project status</h2><div className="mt-4 text-sm text-slate-600">Current: <strong>{project.status}</strong></div><div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full w-1/4 bg-slate-900 rounded-full" /></div><p className="text-xs text-slate-500 mt-2">Brief → Design → Presentation → Approval → Execution</p></div>
            <div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="font-semibold">Client access</h2><p className="text-sm text-slate-500 mt-2">Authorised emails</p><ul className="mt-3 space-y-2">{emails.length ? emails.map((email) => <li key={email} className="text-sm break-all">{email}</li>) : <li className="text-sm text-amber-600">No client email configured yet.</li>}</ul></div>
            <div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="font-semibold">Materials</h2><p className="text-sm text-slate-500 mt-2">{project.materials_required.length} material requirement(s)</p>{project.materials_required.length > 0 && <ul className="mt-3 text-sm text-slate-700 list-disc pl-5">{project.materials_required.map((item) => <li key={item}>{item}</li>)}</ul>}</div>
          </aside>
        </div>
      </div>
    </main>
  );
}
