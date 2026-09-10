import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { createProcurementFromProposal, updateProcurementStatus } from '@/app/admin-dashboard/procurement-actions';

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planned', quoted: 'Quoted', ordered: 'Ordered', partially_received: 'Partially received', received: 'Received', cancelled: 'Cancelled',
};

export default async function ProcurementPage({ params }: { params: Promise<{ project: string }> }) {
  await requireAdmin();
  const { project: slug } = await params;
  const supabase = createAdminClient();
  const { data: project } = await supabase.from('projects').select('id, slug, project_code, client_name').eq('slug', slug).maybeSingle();
  if (!project) notFound();

  const [{ data: items }, { data: approvedProposal }] = await Promise.all([
    supabase.from('procurement_items').select('id, proposal_id, project_space_id, description, quantity, unit, estimated_unit_cost, estimated_total, status, needed_by, suppliers(name)').eq('project_id', project.id).order('created_at', { ascending: false }),
    supabase.from('proposals').select('id, proposal_number, total, approved_at').eq('project_id', project.id).eq('status', 'approved').order('version', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const total = (items ?? []).reduce((sum, item) => sum + Number(item.estimated_total || 0), 0);
  const received = (items ?? []).filter((item) => item.status === 'received').length;

  return <main className="min-h-screen bg-stone-50 px-6 py-10"><div className="mx-auto max-w-7xl">
    <div className="mb-8 flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">{project.project_code} · {project.client_name}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Procurement</h1><p className="mt-1 text-sm text-stone-500">Turn the approved design into a controlled purchasing list.</p></div><Link href={`/admin-dashboard/${slug}/proposal`} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700">Back to Proposal</Link></div>

    {!approvedProposal ? <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><h2 className="font-semibold text-amber-950">Approval required</h2><p className="mt-1 text-sm text-amber-900">Procurement can only be generated from an approved client proposal.</p></section> : <>
      <section className="mb-6 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-xs uppercase tracking-wider text-stone-500">Approved proposal</p><p className="mt-2 text-lg font-semibold text-stone-900">{approvedProposal.proposal_number}</p></div><div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-xs uppercase tracking-wider text-stone-500">Procurement estimate</p><p className="mt-2 text-lg font-semibold text-stone-900">KES {total.toLocaleString()}</p></div><div className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-xs uppercase tracking-wider text-stone-500">Received</p><p className="mt-2 text-lg font-semibold text-stone-900">{received} / {(items ?? []).length} items</p></div></section>
      <form action={async () => { 'use server'; await createProcurementFromProposal(approvedProposal.id); }} className="mb-6"><button className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white">Sync from approved proposal</button></form>
      <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white"><div className="border-b border-stone-200 px-6 py-4"><h2 className="font-semibold text-stone-900">Purchase list</h2></div><div className="divide-y divide-stone-100">{(items ?? []).length === 0 ? <p className="p-6 text-sm text-stone-500">No procurement items yet. Sync the approved proposal to create them.</p> : (items ?? []).map((item) => <div key={item.id} className="grid gap-3 px-6 py-5 md:grid-cols-[1fr_auto_auto] md:items-center"><div><p className="font-medium text-stone-900">{item.description}</p><p className="mt-1 text-xs text-stone-500">{item.quantity} {item.unit} · Estimated KES {Number(item.estimated_total || 0).toLocaleString()}</p></div><span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">{STATUS_LABELS[item.status] || item.status}</span><form action={async (formData) => { 'use server'; await updateProcurementStatus({ itemId: item.id, status: String(formData.get('status')) }); }}><select name="status" defaultValue={item.status} className="rounded-xl border border-stone-300 px-3 py-2 text-sm" aria-label={`Status for ${item.description}`}><option value="planned">Planned</option><option value="quoted">Quoted</option><option value="ordered">Ordered</option><option value="partially_received">Partially received</option><option value="received">Received</option><option value="cancelled">Cancelled</option></select><button className="ml-2 rounded-xl border border-stone-300 px-3 py-2 text-sm">Update</button></form></div>)}</div></section>
    </>}
  </div></main>;
}
