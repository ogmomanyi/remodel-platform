import { redirect } from 'next/navigation';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { MaterialCard } from '@/components/mdx/MaterialCard';
import { ApproveButton } from '@/components/ApproveButton';
import { createClient } from '@/utils/supabase/server';
import { getProjectBySlug, userCanAccessProject } from '@/lib/projects';

const components = { MaterialCard };

type Props = { params: Promise<{ client: string }> };

type Proposal = {
  id: string;
  proposal_number: string;
  title: string;
  status: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total: number;
  notes: string | null;
  valid_until: string | null;
  lines: Array<{ id: string; description: string; quantity: number; unit: string; selling_total: number; space_name: string | null }>;
};

export default async function ClientPresentation({ params }: Props) {
  const { client } = await params;
  const legacyProject = getProjectBySlug(client);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/client-login?next=/${client}`);

  let projectCode: string;
  let clientName: string;
  let content = '';
  let projectStatus = 'pending';
  let canAccess = false;
  let proposal: Proposal | null = null;

  if (legacyProject) {
    projectCode = legacyProject.project_code;
    clientName = legacyProject.client_name;
    content = legacyProject.content;
    projectStatus = legacyProject.status || 'pending';
    canAccess = userCanAccessProject(legacyProject, user.email);
  } else {
    const { data: dbProject } = await supabase.from('projects').select('id, project_code, client_name, description, status').eq('slug', client).maybeSingle();
    if (!dbProject) return <div className="p-10 text-red-500">Proposal not found.</div>;
    projectCode = dbProject.project_code;
    clientName = dbProject.client_name;
    content = dbProject.description || '';
    projectStatus = dbProject.status || 'pending';
    const { data: member } = await supabase.from('project_members').select('email').eq('project_id', dbProject.id).ilike('email', user.email || '').maybeSingle();
    canAccess = Boolean(member);
    if (canAccess) {
      const { data: latest } = await supabase.from('proposals').select('id, proposal_number, title, status, currency, subtotal, tax_amount, total, notes, valid_until').eq('project_id', dbProject.id).in('status', ['sent', 'approved', 'rejected', 'expired']).order('version', { ascending: false }).limit(1).maybeSingle();
      if (latest) {
        const { data: lines } = await supabase.from('proposal_lines').select('id, description, quantity, unit, selling_total, project_space_id').eq('proposal_id', latest.id).order('sort_order');
        const spaceIds = (lines ?? []).map((line) => line.project_space_id).filter(Boolean) as string[];
        const { data: spaces } = spaceIds.length ? await supabase.from('project_spaces').select('id, name').in('id', spaceIds) : { data: [] };
        const spaceMap = new Map((spaces ?? []).map((space) => [space.id, space.name]));
        proposal = { ...latest, subtotal: Number(latest.subtotal), tax_amount: Number(latest.tax_amount), total: Number(latest.total), lines: (lines ?? []).map((line) => ({ ...line, quantity: Number(line.quantity), selling_total: Number(line.selling_total), space_name: line.project_space_id ? spaceMap.get(line.project_space_id) || null : null })) };
      }
    }
  }

  if (!canAccess) return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6"><div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md"><h2 className="text-xl font-bold text-red-600 mb-2">Unauthorized Access</h2><p className="text-gray-600">Your account does not have permission to view this project.</p></div></div>;

  const { data: approvalRecord } = await supabase.from('project_approvals').select('status, approved_by, approved_at').eq('project_code', projectCode).maybeSingle();
  const currentStatus = approvalRecord?.status || projectStatus || 'pending';
  const money = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return <main className="max-w-5xl mx-auto p-6 md:p-10 bg-slate-50 min-h-screen"><header className="mb-10 pb-5 border-b border-gray-200 flex flex-col md:flex-row md:justify-between md:items-end gap-4"><div><p className="text-sm text-gray-500 mb-2">Kota Designs · Client Proposal</p><h1 className="text-3xl font-bold">{clientName}</h1><p className="text-gray-500 font-mono mt-2">Ref: {projectCode}</p></div><div className="flex items-center gap-4"><span className={`px-3 py-1 text-xs font-bold rounded-full ${currentStatus === 'approved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{currentStatus.toUpperCase()}</span><div className="text-sm text-gray-500">{user.email}</div></div></header>
    {proposal && <section className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8 mb-8"><div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-slate-500">Quotation {proposal.proposal_number}</p><h2 className="text-2xl font-bold mt-1">{proposal.title}</h2>{proposal.valid_until && <p className="text-sm text-slate-500 mt-1">Valid until {proposal.valid_until}</p>}</div><span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-semibold uppercase">{proposal.status}</span></div><div className="mt-6 divide-y divide-gray-100">{proposal.lines.map((line) => <div key={line.id} className="py-3 flex justify-between gap-4 text-sm"><div><p className="font-medium">{line.description}</p><p className="text-xs text-slate-500 mt-1">{line.space_name || 'Project'} · {line.quantity} {line.unit}</p></div><p className="font-semibold whitespace-nowrap">{proposal.currency} {money.format(line.selling_total)}</p></div>)}</div><div className="mt-6 pt-5 border-t border-gray-200 ml-auto max-w-sm space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{proposal.currency} {money.format(proposal.subtotal)}</span></div><div className="flex justify-between"><span>Tax</span><span>{proposal.currency} {money.format(proposal.tax_amount)}</span></div><div className="flex justify-between text-lg font-bold pt-2"><span>Total</span><span>{proposal.currency} {money.format(proposal.total)}</span></div></div>{proposal.notes && <p className="mt-6 text-sm text-slate-600 whitespace-pre-wrap">{proposal.notes}</p>}</section>}
    {content && <article className="prose prose-slate max-w-none"><MDXRemote source={content} components={components} /></article>}
    <ApproveButton projectCode={projectCode} initialStatus={currentStatus} approvedBy={approvalRecord?.approved_by ?? null} approvedAt={approvalRecord?.approved_at ?? null} />
  </main>;
}
