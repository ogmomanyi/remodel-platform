import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export default async function ClientDashboard() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Enforce Authentication
  if (!user) {
    redirect('/login');
  }

  const projectsDir = path.join(process.cwd(), 'src/content/projects');
  const accessibleProjects = [];

  // 2. Scan and Filter File System
  if (fs.existsSync(projectsDir)) {
    const projectFolders = fs.readdirSync(projectsDir);
    for (const folder of projectFolders) {
      const mdxPath = path.join(projectsDir, folder, 'proposal.mdx');
      if (fs.existsSync(mdxPath)) {
        const fileContent = fs.readFileSync(mdxPath, 'utf8');
        const { data: frontmatter } = matter(fileContent);

        // Check if the logged-in user's email is in the allowed_emails array
        if (frontmatter.allowed_emails?.includes(user.email)) {
          accessibleProjects.push({
            slug: folder,
            client_name: frontmatter.client_name || folder,
            project_code: frontmatter.project_code || 'N/A',
            status: frontmatter.status || 'Pending',
          });
        }
      }
    }
  }

  // 3. Fetch live statuses from database
  const projectCodes = accessibleProjects.map(p => p.project_code);
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
  const projectsWithLiveStatus = accessibleProjects.map(project => {
    const dbRecord = statusMap.get(project.project_code);
    return {
      ...project,
      status: dbRecord?.status || project.status,
    };
  });

  // 4. Render the Dashboard
  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Client Portal</h1>
            <p className="text-gray-500 mt-1">Welcome back, {user.email}</p>
          </div>
          <form action="/auth/signout" method="POST">
            <button
              className="text-sm font-medium text-gray-600 hover:text-black border border-gray-300 px-4 py-2 rounded transition"
            >
              Sign Out
            </button>
          </form>
        </header>

        {projectsWithLiveStatus.length === 0 ? (
          <div className="bg-white p-10 rounded-lg shadow-sm border border-gray-200 text-center">
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No Projects Found</h2>
            <p className="text-gray-500">You do not currently have access to any active project proposals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projectsWithLiveStatus.map((project) => (
              <Link href={`/${project.slug}`} key={project.slug}>
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer group">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {project.project_code}
                    </span>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${
                      project.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {project.status.toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-800 group-hover:text-black mb-2">
                    {project.client_name}
                  </h2>
                  <p className="text-sm text-gray-500 font-medium">View Proposal &rarr;</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
