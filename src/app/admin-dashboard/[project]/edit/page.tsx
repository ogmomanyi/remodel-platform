import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { getProjectBySlug } from '@/lib/projects';
import { DesignStudioActions } from '@/components/admin/DesignStudioActions';

export default async function DesignStudioPage({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin();
  const { project: slug } = await params;
  const project = getProjectBySlug(slug);
  if (!project) notFound();

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7">
          <div>
            <Link href="/admin-dashboard" className="text-sm text-slate-600 hover:text-black">← Dashboard</Link>
            <p className="text-xs uppercase tracking-wider text-slate-500 mt-4">Design Studio</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">{project.client_name}</h1>
            <p className="font-mono text-sm text-slate-500 mt-2">{project.project_code}</p>
          </div>
          <Link href={`/${project.slug}`} target="_blank" className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium">Preview client presentation ↗</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold">Project brief</h2>
              <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{project.frontmatter.description as string || 'Add the brief when creating or editing the project.'}</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-5"><div><h2 className="text-lg font-semibold">Spaces & design options</h2><p className="text-sm text-gray-500 mt-1">Build the renovation area by area.</p></div><span className="text-xs rounded-full bg-slate-100 px-3 py-1">Studio foundation</span></div>
              <div className="grid sm:grid-cols-2 gap-4">
                {['Existing space & site conditions', 'Patio / veranda', 'Interior living areas', 'Carpentry & joinery'].map((space) => <div key={space} className="rounded-lg border border-dashed border-gray-300 p-5"><h3 className="font-medium text-gray-900">{space}</h3><p className="text-sm text-gray-500 mt-2">Add photos, measurements, concepts, materials and proposed visuals.</p><button className="mt-4 text-sm font-medium text-blue-700">Add design option →</button></div>)}
              </div>
            </div>

            <DesignStudioActions projectSlug={project.slug} />
          </section>

          <aside className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="font-semibold">Project status</h2><div className="mt-4 text-sm text-slate-600">Current: <strong>{project.status}</strong></div><div className="mt-4 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full w-1/4 bg-slate-900 rounded-full" /></div><p className="text-xs text-slate-500 mt-2">Brief → Design → Presentation → Approval → Execution</p></div>
            <div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="font-semibold">Client access</h2><p className="text-sm text-slate-500 mt-2">Authorised emails</p><ul className="mt-3 space-y-2">{project.allowed_emails.length ? project.allowed_emails.map((email) => <li key={email} className="text-sm break-all">{email}</li>) : <li className="text-sm text-amber-600">No client email configured yet.</li>}</ul></div>
            <div className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="font-semibold">Materials</h2><p className="text-sm text-slate-500 mt-2">{project.materials_required.length} material requirement(s)</p>{project.materials_required.length > 0 && <ul className="mt-3 text-sm text-slate-700 list-disc pl-5">{project.materials_required.map((item) => <li key={item}>{item}</li>)}</ul>}</div>
          </aside>
        </div>
      </div>
    </main>
  );
}
