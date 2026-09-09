'use client';

import { useState, useTransition } from 'react';
import { createProposal } from '@/app/admin-dashboard/proposal-actions';

type Option = { id: string; spaceId: string; spaceName: string; name: string; description: string | null; costEstimate: number | null; materialCost: number };

export function ProposalBuilder({ projectSlug, projectCode, options }: { projectSlug: string; projectCode: string; options: Option[] }) {
  const [selected, setSelected] = useState<string[]>(options.filter((o) => o.costEstimate != null).map((o) => o.id));
  const [markup, setMarkup] = useState('30');
  const [tax, setTax] = useState('0');
  const [title, setTitle] = useState('Renovation Proposal');
  const [validUntil, setValidUntil] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const selectedOptions = options.filter((o) => selected.includes(o.id));
  const subtotal = selectedOptions.reduce((sum, o) => { const basis = o.materialCost > 0 ? o.materialCost : (o.costEstimate ?? 0); return sum + basis * (1 + Number(markup || 0) / 100); }, 0);
  const taxAmount = subtotal * Number(tax || 0) / 100;
  const total = subtotal + taxAmount;
  const money = new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function toggle(id: string) { setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]); }
  function submit() {
    setMessage('');
    startTransition(async () => {
      try {
        const proposal = await createProposal({ projectSlug, title, currency: 'KES', markupPercent: Number(markup), taxPercent: Number(tax), validUntil, notes, optionIds: selected });
        setMessage(`Created ${proposal.proposal_number} · KES ${money.format(Number(proposal.total))}`);
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create proposal.'); }
    });
  }

  return <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
    <div><p className="text-xs uppercase tracking-wider text-slate-500">Commercial</p><h2 className="text-xl font-semibold mt-1">Quotation & Proposal Builder</h2><p className="text-sm text-slate-500 mt-2">Build a client price from the design options and material BOM already captured in Studio.</p></div>
    <div className="grid md:grid-cols-2 gap-4">
      <label className="text-sm">Proposal title<input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
      <label className="text-sm">Valid until<input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
      <label className="text-sm">Markup %<input type="number" min="0" max="500" step="0.1" value={markup} onChange={(e) => setMarkup(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
      <label className="text-sm">Tax %<input type="number" min="0" max="100" step="0.1" value={tax} onChange={(e) => setTax(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
    </div>
    <label className="text-sm block">Proposal notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Payment terms, exclusions, lead time, assumptions..." className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" /></label>
    <div className="border-t pt-5"><div className="flex items-center justify-between mb-3"><h3 className="font-semibold">Select design options</h3><span className="text-xs text-slate-500">{selected.length} selected</span></div>
      {options.length === 0 ? <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-4">Create design options in Space Manager before building a quotation.</p> : <div className="space-y-2">{options.map((option) => { const checked = selected.includes(option.id); const basis = option.materialCost > 0 ? option.materialCost : (option.costEstimate ?? 0); const sell = basis * (1 + Number(markup || 0) / 100); return <label key={option.id} className={`flex gap-3 items-start rounded-lg border p-4 cursor-pointer ${checked ? 'border-slate-900 bg-slate-50' : 'border-gray-200'}`}><input type="checkbox" checked={checked} onChange={() => toggle(option.id)} className="mt-1" /><div className="flex-1"><div className="flex justify-between gap-4"><div><p className="font-medium">{option.spaceName} · {option.name}</p><p className="text-xs text-slate-500 mt-1">{option.description || 'Design option'}</p></div><div className="text-right text-sm font-medium whitespace-nowrap">KES {money.format(sell)}</div></div><p className="text-xs text-slate-400 mt-2">Internal basis: KES {money.format(basis)} · Material BOM: KES {money.format(option.materialCost)}</p></div></label>; })}</div>}
    </div>
    <div className="rounded-xl bg-slate-900 text-white p-5"><div className="grid grid-cols-3 gap-4 text-sm"><div><p className="text-slate-400">Subtotal</p><p className="text-lg font-semibold mt-1">KES {money.format(subtotal)}</p></div><div><p className="text-slate-400">Tax</p><p className="text-lg font-semibold mt-1">KES {money.format(taxAmount)}</p></div><div><p className="text-slate-400">Client total</p><p className="text-xl font-bold mt-1">KES {money.format(total)}</p></div></div></div>
    <div className="flex items-center justify-between gap-4"><p className="text-sm text-slate-600">Reference: <span className="font-mono">{projectCode}-P(next)</span>{message && <span className="block text-emerald-700 mt-1">{message}</span>}</p><button onClick={submit} disabled={isPending || selected.length === 0} className="rounded-lg bg-black text-white px-5 py-2.5 text-sm font-medium disabled:opacity-40">{isPending ? 'Creating…' : 'Create quotation'}</button></div>
  </div>;
}
