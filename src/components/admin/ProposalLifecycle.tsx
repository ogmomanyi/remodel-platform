'use client';

import { useState, useTransition } from 'react';
import { rejectProposal, sendProposal } from '@/app/admin-dashboard/proposal-actions';

export function ProposalLifecycle({ proposalId, status }: { proposalId: string; status: string }) {
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  function run(action: () => Promise<void>, success: string) {
    setMessage('');
    startTransition(async () => { try { await action(); setMessage(success); } catch (error) { setMessage(error instanceof Error ? error.message : 'Action failed.'); } });
  }
  if (status === 'draft') return <button disabled={isPending} onClick={() => run(() => sendProposal(proposalId), 'Proposal sent.')} className="rounded-lg bg-black text-white px-4 py-2 text-sm font-medium disabled:opacity-40">{isPending ? 'Sending…' : 'Send to client'}</button>;
  if (status === 'sent') return <div className="flex flex-wrap items-center gap-2"><span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold">Awaiting client response</span><button disabled={isPending} onClick={() => run(() => rejectProposal(proposalId, 'Rejected by administrator'), 'Proposal marked rejected.')} className="rounded-lg border border-red-200 text-red-700 px-3 py-2 text-sm disabled:opacity-40">Reject</button></div>;
  return <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold uppercase">{status}</span>;
}
