'use client';

import { useState } from 'react';
import { updatePurchaseOrderStatus } from '@/app/admin-dashboard/purchase-order-actions';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  ordered: 'Ordered',
  partially_received: 'Partially received',
  received: 'Received',
  cancelled: 'Cancelled',
};

export function PurchaseOrderStatusControl({
  purchaseOrderId,
  initialStatus,
}: {
  purchaseOrderId: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    setBusy(true);
    setMessage('');
    try {
      await updatePurchaseOrderStatus({ purchaseOrderId, status });
      setMessage('Saved');
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not update purchase order.');
    } finally {
      setBusy(false);
    }
  }

  const closed = initialStatus === 'received' || initialStatus === 'cancelled';

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        disabled={closed || busy}
        className="rounded-xl border border-stone-300 px-3 py-2 text-sm disabled:bg-stone-50 disabled:text-stone-400"
        aria-label="Purchase order status"
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={save}
        disabled={closed || busy || status === initialStatus}
        className="rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium disabled:opacity-40"
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      {message && <span className="w-full text-right text-[11px] text-stone-500">{message}</span>}
    </div>
  );
}
