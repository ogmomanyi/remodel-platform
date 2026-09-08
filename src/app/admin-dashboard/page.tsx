import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createClient } from '@/utils/supabase/server';

export default async function AdminDashboard() {
  // Check admin authentication
  const cookieStore = await cookies();
  const adminAuth = cookieStore.get('admin_auth');
  
  if (!adminAuth || adminAuth.value !== 'true') {
    redirect('/admin-login');
  }

  const supabase = await createClient();
  const projectsDir = path.join(process.cwd(), 'src/content/projects');
  const allProjects = [];

  // Scan all projects (admin sees everything)
  if (fs.existsSync(projectsDir)) {
    const projectFolders = fs.readdirSync(projectsDir);
    for (const folder of projectFolders) {
      const mdxPath = path.join(projectsDir, folder, 'proposal.mdx');
      if (fs.existsSync(mdxPath)) {
        const fileContent = fs.readFileSync(mdxPath, 'utf8');
        const { data: frontmatter } = matter(fileContent);

        allProjects.push({
          slug: folder,
          client_name: frontmatter.client_name || folder,
          project_code: frontmatter.project_code || 'N/A',
          status: frontmatter.status || 'Pending',
          allowed_emails: frontmatter.allowed_emails || [],
          materials_required: frontmatter.materials_required || [],
          carpentry_labor_hours: frontmatter.carpentry_labor_hours || 0,
        });
      }
    }
  }

  // Fetch live statuses from database
  const projectCodes = allProjects.map(p => p.project_code);
  const { data: approvalRecords } = await supabase
    .from('project_approvals')
    .select('*')
    .in('project_code', projectCodes);

  // Create a map for quick lookup
  const statusMap = new Map();
  approvalRecords?.forEach(record => {
    statusMap.set(record.project_code, record);
  });

  // Update statuses with database values
  const projectsWithLiveStatus = allProjects.map(project => {
    const dbRecord = statusMap.get(project.project_code);
    return {
      ...project,
      status: dbRecord?.status || project.status,
      approved_by: dbRecord?.approved_by,
      approved_at: dbRecord?.approved_at,
    };
  });

  // Calculate statistics
  const totalProjects = projectsWithLiveStatus.length;
  const approvedProjects = projectsWithLiveStatus.filter(p => p.status === 'approved').length;
  const pendingProjects = projectsWithLiveStatus.filter(p => p.status !== 'approved').length;

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8 pb-6 border-b border-gray-200">
          <div>
            <Link href="/" className="text-slate-600 hover:text-slate-900 mb-2 inline-block">
              ← Back to Home
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Kota Designs Admin</h1>
            <p className="text-gray-500 mt-1">Project Management Dashboard</p>
          </div>
          <div className="flex gap-4">
            <form action="/admin-signout" method="POST">
              <button
                className="text-sm font-medium text-gray-600 hover:text-black border border-gray-300 px-4 py-2 rounded transition"
              >
                Logout
              </button>
            </form>
          </div>
        </header>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Total Projects</h3>
            <p className="text-3xl font-bold text-gray-900">{totalProjects}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Approved</h3>
            <p className="text-3xl font-bold text-green-600">{approvedProjects}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Pending</h3>
            <p className="text-3xl font-bold text-yellow-600">{pendingProjects}</p>
          </div>
        </div>

        {/* Projects Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">All Projects</h2>
            <Link 
              href="/admin-dashboard/new-project"
              className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 transition"
            >
              + New Project
            </Link>
          </div>
          
          {projectsWithLiveStatus.length === 0 ? (
            <div className="p-10 text-center">
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Projects Found</h3>
              <p className="text-gray-500">Create your first project to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Clients</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Labor Hours</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {projectsWithLiveStatus.map((project) => (
                    <tr key={project.slug} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{project.client_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 font-mono">{project.project_code}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${
                          project.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {project.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{project.allowed_emails.length} client(s)</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">{project.carpentry_labor_hours}h</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <Link 
                            href={`/${project.slug}`}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </Link>
                          <Link 
                            href={`/admin-dashboard/${project.slug}/edit`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link 
                href="/admin-dashboard/catalog"
                className="block text-blue-600 hover:text-blue-900"
              >
                Manage Material Catalog →
              </Link>
              <Link 
                href="/admin-dashboard/reports"
                className="block text-blue-600 hover:text-blue-900"
              >
                View Reports →
              </Link>
              <Link 
                href="/admin-dashboard/settings"
                className="block text-blue-600 hover:text-blue-900"
              >
                Settings →
              </Link>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="text-sm text-gray-500">
              <p>No recent activity to display</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
