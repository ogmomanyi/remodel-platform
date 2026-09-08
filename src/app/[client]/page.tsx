import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { redirect } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { MaterialCard } from '@/components/mdx/MaterialCard';
import { createClient } from '@/utils/supabase/server';
import { ApproveButton } from '@/components/ApproveButton';

const components = { MaterialCard };

export default async function ClientPresentation({ params }: { params: { client: string } }) {
  const { client } = params;
  const filePath = path.join(process.cwd(), 'src/content', 'projects', client, 'proposal.mdx');

  if (!fs.existsSync(filePath)) {
    return <div className="p-10 text-red-500">Proposal not found.</div>;
  }

  const fileContent = fs.readFileSync(filePath, 'utf8');
  const { content, data: frontmatter } = matter(fileContent);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect(`/login?next=/${client}`);

  if (!frontmatter.allowed_emails?.includes(user.email)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h2 className="text-xl font-bold text-red-600 mb-2">Unauthorized Access</h2>
          <p className="text-gray-600">Your account ({user.email}) does not have permission to view this project.</p>
        </div>
      </div>
    );
  }

  // --- FETCH DYNAMIC STATUS FROM DATABASE ---
  const { data: approvalRecord } = await supabase
    .from('project_approvals')
    .select('*')
    .eq('project_code', frontmatter.project_code)
    .single();

  // Override MDX status with DB status if it exists
  const currentStatus = approvalRecord?.status || frontmatter.status || 'pending';
  // ------------------------------------------

  return (
    <main className="max-w-4xl mx-auto p-8 bg-slate-50 min-h-screen">
      <header className="mb-10 pb-5 border-b border-gray-200 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold">{frontmatter.client_name}</h1>
          <p className="text-gray-500 font-mono mt-2">Ref: {frontmatter.project_code}</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Display Badge in Header */}
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${
            currentStatus === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {currentStatus.toUpperCase()}
          </span>
          <div className="text-sm text-gray-500">Logged in as {user.email}</div>
        </div>
      </header>
      <article className="prose prose-slate max-w-none">
        <MDXRemote source={content} components={components} />
      </article>
      {/* Action Area at the Bottom */}
      <ApproveButton
        projectCode={frontmatter.project_code}
        initialStatus={currentStatus}
        approvedBy={approvalRecord?.approved_by}
        approvedAt={approvalRecord?.approved_at}
      />
    </main>
  );
}
