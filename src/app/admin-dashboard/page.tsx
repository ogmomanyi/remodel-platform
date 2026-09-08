import Link from 'next/link';
import { requireAdmin } from '@/lib/admin-auth';
import { listProjects } from '@/lib/projects';
import { createClient } from '@/utils/supabase/server';

export default async function AdminDashboard() {
  await requireAdmin();

  const supabase = await createClient();
  const projects = listProjects();
  const projectCodes = projects.map((project) => project.project_code).filter(Boolean);

  const { data: approvalRecords } = projectCodes.length
    ? await supabase
        .from('project_approvals')
        .select('project_code, status, approved_by, approved_at')
        .in('project_code', projectCodes)
    : { data: [] };

  const statusMap = new Map(
    (approvalRecords ?? []).map((record) => [record.project_code, record])
  );

  const projectsWithLiveStatus = projects.map((project) => {
    const record = statusMap.get(project.project_code);
    return {
      ...project,
      status: record?.status || project.status || 'draft',
      approved_by: record?.approved_by,
      approved_at: record?.approved_at,
    };
  });

  const totalProjects = projectsWithLiveStatus.length;
  const approvedProjects = projectsWithLiveStatus.filter((p) => p.status === 'approved').length;
  const pendingProjects = projectsWithLiveStatus.filter((p) => p.status !== 'approved').length;

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8 pb-6 border-b border-gray-200">
          <div>
            <Link href="/" className="text-slate-600 hover:text-slate-900 mb-2 inline-block">← Back to Home</Link>
            <h1 className="text-3xl font-bold text-gray-900">Kota Designs Admin</h1>
            <p className="text-gray-500 mt-1">Design, visualisation and project management</p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin-dashboard/new-project" className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800">+ New Project</Link>
            <form action="/admin-signout" method="POST">
              <button className="text-sm font-medium text-gray-600 hover:text-black border border-gray-300 bg-white px-4 py-2 rounded">Logout</button>
            </form>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <Stat label="Total Projects" value={totalProjects} />
          <Stat label="Approved" value={approvedProjects} />
          <Stat label="Needs Attention" value={pendingProjects} />
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Projects</h2>
            <p className="text-sm text-gray-500 mt-1">Open a project to build spaces, design options, visuals and the client presentation.</p>
          </div>
          {projectsWithLiveStatus.length === 0 ? (
            <div className="p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-700">No projects yet</h3>
              <p className="text-gray-500 mt-2 mb-5">Create a project to start your first home makeover presentation.</p>
              <Link href="/admin-dashboard/new-project" className="inline-block bg-black text-white px-5 py-2.5 rounded-lg">Create project</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Clients</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projectsWithLiveStatus.map((project) => (
                    <tr key={project.slug} className="hover:bg-gray-50">
                      <td className="px-6 py-4"><div className="font-medium text-gray-900">{project.client_name}</div><div className="text-xs text-gray-500">{project.slug}</div></td>
                      <td className="px-6 py-4 text-sm font-mono text-gray-500">{project.project_code}</td>
                      <td className="px-6 py-4"><StatusBadge status={project.status} /></td>
                      <td className="px-6 py-4 text-sm text-gray-500">{project.allowed_emails.length}</td>
                      <td className="px-6 py-4"><div className="flex gap-3 text-sm"><Link href={`/admin-dashboard/${project.slug}/edit`} className="font-medium text-blue-700 hover:text-blue-900">Design Studio</Link><Link href={`/${project.slug}`} className="text-gray-600 hover:text-gray-900">Preview</Link></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
          <QuickCard title="Design Studio" text="Organise spaces, options, materials and visual directions." href="/admin-dashboard" />
          <QuickCard title="Material Catalog" text="Build a reusable library of flooring, finishes and carpentry details." href="/admin-dashboard/catalog" />
          <QuickCard title="Client Presentation" text="Preview exactly what the client will see before sending." href="/admin-dashboard" />
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"><p className="text-sm font-medium text-gray-500">{label}</p><p className="text-3xl font-bold text-gray-900 mt-2">{value}</p></div>;
}

function StatusBadge({ status }: { status: string }) {
  const approved = status === 'approved';
  return <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${approved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{status.replaceAll('-', ' ').toUpperCase()}</span>;
}

function QuickCard({ title, text, href }: { title: string; text: string; href: string }) {
  return <Link href={href} className="bg-white p-6 rounded-xl border border-gray-200 hover:border-gray-400 hover:shadow-sm transition"><h3 className="font-semibold text-gray-900">{title}</h3><p className="text-sm text-gray-500 mt-2">{text}</p><span className="text-sm font-medium text-blue-700 inline-block mt-4">Open →</span></Link>;
}
