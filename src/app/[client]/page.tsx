import { redirect } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { MaterialCard } from '@/components/mdx/MaterialCard';
import { ApproveButton } from '@/components/ApproveButton';
import { createClient } from '@/utils/supabase/server';
import { getProjectBySlug, userCanAccessProject } from '@/lib/projects';

const components = { MaterialCard };

type Props = {
  params: Promise<{ client: string }>;
};

export default async function ClientPresentation({ params }: Props) {
  const { client } = await params;
  const project = getProjectBySlug(client);

  if (!project) {
    return <div className="p-10 text-red-500">Proposal not found.</div>;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/client-login?next=/${client}`);

  if (!userCanAccessProject(project, user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Unauthorized Access</h2>
          <p className="text-gray-600">Your account does not have permission to view this project.</p>
        </div>
      </div>
    );
  }

  const { data: approvalRecord } = await supabase
    .from('project_approvals')
    .select('status, approved_by, approved_at')
    .eq('project_code', project.project_code)
    .maybeSingle();

  const currentStatus = approvalRecord?.status || project.status || 'pending';

  return (
    <main className="max-w-5xl mx-auto p-6 md:p-10 bg-slate-50 min-h-screen">
      <header className="mb-10 pb-5 border-b border-gray-200 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <div>
          <p className="text-sm text-gray-500 mb-2">Kota Designs · Client Proposal</p>
          <h1 className="text-3xl font-bold">{project.client_name}</h1>
          <p className="text-gray-500 font-mono mt-2">Ref: {project.project_code}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
            currentStatus === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {currentStatus.toUpperCase()}
          </span>
          <div className="text-sm text-gray-500">{user.email}</div>
        </div>
      </header>

      <article className="prose prose-slate max-w-none">
        <MDXRemote source={project.content} components={components} />
      </article>

      <ApproveButton
        projectCode={project.project_code}
        initialStatus={currentStatus}
        approvedBy={approvalRecord?.approved_by ?? null}
        approvedAt={approvalRecord?.approved_at ?? null}
      />
    </main>
  );
}
