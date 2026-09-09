import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { buildBom } from '@/lib/bom';
import { ProposalBuilder } from '@/components/admin/ProposalBuilder';
import { ProposalLifecycle } from '@/components/admin/ProposalLifecycle';

export default async function ProposalPage({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin(); const { project: slug } = await params; const supabase = createAdminClient();
  const { data: project } = await supabase.from('projects').select('id, slug, project_code, client_name').eq('slug', slug).maybeSingle(); if (!project) notFound();
  const { data: spaces } = await supabase.from('project_spaces').select('id, name').eq('project_id', project.id).order('sort_order');
  const spaceIds = (spaces ?? []).map((s) => s.id);
  const { data: options } = spaceIds.length ? await supabase.from('design_options').select('id, space_id, name, description, materials, cost_estimate').in('space_id', spaceIds).order('sort_order') : { data: [] };
  const spaceMap = new Map((spaces ?? []).map((s) => [s.id, s.name]));
  const builderOptions = (options ?? []).map((option) => ({ id: option.id, spaceId: option.space_id, spaceName: spaceMap.get(option.space_id) || 'Space', name: option.name, description: option.description, costEstimate: option.cost_estimate, materialCost: buildBom(Array.isArray(option.materials) ? option.materials : []).material_total }));
  const { data: proposals } = await supabase.from('proposals').select('id, proposal_number, version, title, status, currency, subtotal, tax_amount, total, created_at').eq('project_id', project.id).order('version', { ascending: false });
  return <main className="min-h-screen bg-slate-100 p-6 md:p-8"><div className="max-w-6xl mx-auto"><div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-7"><div><Link href={`/admin-dashboard/${slug}/edit`} className="text-sm text-slate-600 hover:text-black">← Design Studio</Link><p className="text-xs uppercase tracking-wider text-slate-500 mt-4">Commercial</p><h1 className="text-3xl font-bold text-gray-900 mt-1">{project.client_name}</h1><p className="font-mono text-sm text-slate-500 mt-2">{project.project_code}</p></div><Link href={`/admin-dashboard/${slug}/edit`} className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium">Back to Studio</Link></div><div className="space-y-6"><ProposalBuilder projectSlug={project.slug} projectCode={project.project_code} options={builderOptions} />{proposals && proposals.length > 0 && <section className="bg-white rounded-xl border border-gray-200 p-6"><h2 className="font-semibold">Proposal history</h2><div className="mt-4 divide-y divide-gray-100">{proposals.map((proposal) => <div key={proposal.id} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><p className="font-medium">{proposal.proposal_number} · {proposal.title}</p><p className="text-xs text-slate-500 mt-1">Version {proposal.version} · {proposal.status}</p></div><div className="flex items-center gap-4"><p className="font-semibold whitespace-nowrap">{proposal.currency} {Number(proposal.total).toLocaleString('en-KE', { minimumFractionDigits: 2 })}</p><ProposalLifecycle proposalId={proposal.id} status={proposal.status} /></div></div>)}</div></section>}</div></div></main>;
}
