import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

type PortalProject = {
  id: string | null;
  slug: string;
  client_name: string;
  project_code: string;
  status: string;
  source: 'database' | 'legacy';
  progress: number | null;
};

export default async function ClientDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/client-login');

  const { data: dbProjects, error: dbError } = await supabase
    .from('projects')
    .select('id, slug, client_name, project_code, status')
    .order('created_at', { ascending: false });

  if (dbError) throw new Error(`Could not load your projects: ${dbError.message}`);

  const dbIds = (dbProjects ?? []).map((project) => project.id);
  const { data: latestUpdates } = dbIds.length
    ? await supabase
        .from('project_progress_updates')
        .select('project_id, percent_complete, created_at')
        .in('project_id', dbIds)
        .eq('client_visible', true)
        .order('created_at', { ascending: false })
    : { data: [] };

  const latestProgress = new Map<string, number>();
  for (const update of latestUpdates ?? []) {
    if (!latestProgress.has(update.project_id)) {
      latestProgress.set(update.project_id, Number(update.percent_complete ?? 0));
    }
  }

  const projects: PortalProject[] = (dbProjects ?? []).map((project) => ({
    id: project.id,
    slug: project.slug,
    client_name: project.client_name,
    project_code: project.project_code,
    status: project.status,
    source: 'database',
    progress: latestProgress.get(project.id) ?? null,
  }));

  const dbCodes = new Set(projects.map((project) => project.project_code));
  const projectsDir = path.join(process.cwd(), 'src/content/projects');

  if (fs.existsSync(projectsDir)) {
    for (const folder of fs.readdirSync(projectsDir)) {
      const mdxPath = path.join(projectsDir, folder, 'proposal.mdx');
      if (!fs.existsSync(mdxPath)) continue;

      const fileContent = fs.readFileSync(mdxPath, 'utf8');
      const { data: frontmatter } = matter(fileContent);
      const allowedEmails = Array.isArray(frontmatter.allowed_emails) ? frontmatter.allowed_emails : [];
      const projectCode = String(frontmatter.project_code || 'N/A');

      if (allowedEmails.includes(user.email) && !dbCodes.has(projectCode)) {
        projects.push({
          id: null,
          slug: folder,
          client_name: String(frontmatter.client_name || folder),
          project_code: projectCode,
          status: String(frontmatter.status || 'pending'),
          source: 'legacy',
          progress: null,
        });
      }
    }
  }

  const legacyCodes = projects.filter((project) => project.source === 'legacy').map((project) => project.project_code);
  const { data: approvalRecords } = legacyCodes.length
    ? await supabase.from('project_approvals').select('project_code, status').in('project_code', legacyCodes)
    : { data: [] };
  const approvalMap = new Map((approvalRecords ?? []).map((record) => [record.project_code, record.status]));

  const projectsWithStatus = projects.map((project) => ({
    ...project,
    status: project.source === 'legacy' ? approvalMap.get(project.project_code) || project.status : project.status,
  }));

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-5 border-b border-stone-200 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/" className="text-sm text-stone-500 hover:text-stone-900">← Home</Link>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Kota Designs</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Client Portal</h1>
            <p className="mt-2 text-sm text-stone-500">Proposals, approvals and live project progress in one place.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-stone-500 md:inline">{user.email}</span>
            <form action="/auth/signout" method="POST">
              <button className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700">Sign out</button>
            </form>
          </div>
        </header>

        {!projectsWithStatus.length ? (
          <div className="rounded-3xl border border-stone-200 bg-white p-12 text-center">
            <h2 className="text-xl font-semibold text-stone-800">No projects available</h2>
            <p className="mt-2 text-sm text-stone-500">Your account is active, but no project has been shared with this email yet.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {projectsWithStatus.map((project) => (
              <Link href={`/${project.slug}`} key={`${project.source}-${project.slug}`} className="group rounded-3xl border border-stone-200 bg-white p-6 transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 font-mono text-[11px] text-stone-600">{project.project_code}</span>
                  <StatusBadge status={project.status} />
                </div>
                <h2 className="mt-6 text-xl font-semibold text-stone-900">{project.client_name}</h2>
                {project.progress !== null && (
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs text-stone-500">
                      <span>Project progress</span>
                      <span className="font-semibold text-stone-800">{project.progress}%</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-stone-100">
                      <div className="h-2 rounded-full bg-stone-900" style={{ width: `${Math.max(0, Math.min(100, project.progress))}%` }} />
                    </div>
                  </div>
                )}
                <p className="mt-6 text-sm font-medium text-stone-700 group-hover:text-black">
                  {project.progress !== null ? 'Open project →' : 'View proposal →'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const classes =
    normalized === 'approved' || normalized === 'completed'
      ? 'bg-emerald-50 text-emerald-700'
      : normalized === 'in_progress'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-amber-50 text-amber-700';

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${classes}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
