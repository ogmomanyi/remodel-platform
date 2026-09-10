'use client';

import { useState } from 'react';
import { createPurchaseOrder } from '@/app/admin-dashboard/purchase-order-actions';

type Item = { id: string; description: string; quantity: number; unit: string; estimated_total: number };
type Supplier = { id: string; name: string };

export function PurchaseOrderBuilder({ projectSlug, items, suppliers }: { projectSlug: string; items: Item[]; suppliers: Supplier[] }) {
  const [supplierId, setSupplierId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [expectedDelivery, setExpectedDelivery] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  const total = items.filter(i => selected.includes(i.id)).reduce((sum, i) => sum + Number(i.estimated_total || 0), 0);
  async function submit() {
    setBusy(true); setMessage('');
    try { const po = await createPurchaseOrder({ projectSlug, supplierId, itemIds: selected, expectedDelivery, notes }); setMessage(`Created ${po.po_number}. Refreshing…`); window.location.reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create purchase order.'); }
    finally { setBusy(false); }
  }
  return <div className="rounded-3xl border border-stone-200 bg-white p-6">
    <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium">Supplier<select value={supplierId} onChange={e=>setSupplierId(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2"><option value="">Select supplier</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="text-sm font-medium">Expected delivery<input type="date" value={expectedDelivery} onChange={e=>setExpectedDelivery(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" /></label></div>
    <p className="mt-5 text-sm font-medium">Open procurement items</p><div className="mt-2 grid gap-2 md:grid-cols-2">{items.map(item=><label key={item.id} className="flex gap-3 rounded-xl border border-stone-200 p-3 text-sm"><input type="checkbox" checked={selected.includes(item.id)} onChange={()=>toggle(item.id)} className="mt-1" /><span><strong>{item.description}</strong><span className="block text-xs text-stone-500">{item.quantity} {item.unit} · KES {Number(item.estimated_total).toLocaleString()}</span></span></label>)}</div>
    <label className="mt-5 block text-sm font-medium">Notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2" /></label>
    <div className="mt-5 flex items-center justify-between gap-4"><p className="text-sm text-stone-600">Selected: {selected.length} · Estimated total: <strong>KES {total.toLocaleString()}</strong></p><button onClick={submit} disabled={busy || !supplierId || !selected.length} className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">{busy ? 'Creating…' : 'Create purchase order'}</button></div>{message && <p className="mt-3 text-xs font-medium text-stone-600">{message}</p>}
  </div>;
}
