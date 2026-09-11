import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { PurchaseOrderBuilder } from '@/components/admin/PurchaseOrderBuilder';
import { PurchaseOrderStatusControl } from '@/components/admin/PurchaseOrderStatusControl';

type ProcurementItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  estimated_total: number;
  status: string;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  status: string;
  subtotal: number;
  expected_delivery: string | null;
  ordered_at: string | null;
  supplier_id: string;
  created_at: string;
};

type PurchaseOrderLine = {
  id: string;
  purchase_order_id: string;
  description: string;
  quantity: number;
  unit: string;
  line_total: number;
};

export default async function PurchaseOrdersPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  await requireAdmin();

  const { project: slug } = await params;
  const supabase = createAdminClient();

  const { data: project } = await supabase
    .from('projects')
    .select('id, slug, project_code, client_name')
    .eq('slug', slug)
    .maybeSingle();

  if (!project) notFound();

  const [
    { data: rawItems, error: itemsError },
    { data: rawOrders, error: ordersError },
    { data: suppliers, error: suppliersError },
  ] = await Promise.all([
    supabase
      .from('procurement_items')
      .select('id, description, quantity, unit, estimated_total, status')
      .eq('project_id', project.id)
      .not('status', 'in', '(received,cancelled)')
      .order('created_at', { ascending: false }),
    supabase
      .from('purchase_orders')
      .select('id, po_number, status, subtotal, expected_delivery, ordered_at, supplier_id, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('suppliers')
      .select('id, name')
      .eq('active', true)
      .order('name'),
  ]);

  if (itemsError) throw new Error(`Could not load procurement items: ${itemsError.message}`);
  if (ordersError) throw new Error(`Could not load purchase orders: ${ordersError.message}`);
  if (suppliersError) throw new Error(`Could not load suppliers: ${suppliersError.message}`);

  const items: ProcurementItem[] = (rawItems ?? []).map((item) => ({
    ...item,
    quantity: Number(item.quantity),
    estimated_total: Number(item.estimated_total),
  }));

  const orders: PurchaseOrder[] = (rawOrders ?? []).map((order) => ({
    ...order,
    subtotal: Number(order.subtotal),
  }));

  const orderIds = orders.map((order) => order.id);
  const { data: rawLines, error: linesError } = orderIds.length
    ? await supabase
        .from('purchase_order_lines')
        .select('id, purchase_order_id, description, quantity, unit, line_total')
        .in('purchase_order_id', orderIds)
        .order('created_at')
    : { data: [], error: null };

  if (linesError) throw new Error(`Could not load purchase order lines: ${linesError.message}`);

  const lines: PurchaseOrderLine[] = (rawLines ?? []).map((line) => ({
    ...line,
    quantity: Number(line.quantity),
    line_total: Number(line.line_total),
  }));

  const supplierNames = new Map((suppliers ?? []).map((supplier) => [supplier.id, supplier.name]));
  const linesByOrder = new Map<string, PurchaseOrderLine[]>();

  for (const line of lines) {
    const current = linesByOrder.get(line.purchase_order_id) ?? [];
    current.push(line);
    linesByOrder.set(line.purchase_order_id, current);
  }

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              {project.project_code} · {project.client_name}
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-900">Purchase Orders</h1>
            <p className="mt-1 text-sm text-stone-500">Group procurement items by supplier and control ordering through receipt.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin-dashboard/${slug}/procurement`} className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm font-medium">
              Procurement
            </Link>
            <Link href={`/admin-dashboard/${slug}/execution`} className="rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white">
              Execution
            </Link>
          </div>
        </div>

        <section className="mb-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-stone-900">Create purchase order</h2>
            <p className="mt-1 text-sm text-stone-500">Select one supplier and the open items that should be ordered together.</p>
          </div>

          {!suppliers?.length ? (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              Add an active supplier before creating a purchase order.
            </div>
          ) : !items.length ? (
            <div className="rounded-3xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
              No open procurement items are available.
            </div>
          ) : (
            <PurchaseOrderBuilder
              projectSlug={slug}
              items={items.map(({ id, description, quantity, unit, estimated_total }) => ({
                id,
                description,
                quantity,
                unit,
                estimated_total,
              }))}
              suppliers={suppliers}
            />
          )}
        </section>

        <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
          <div className="border-b border-stone-200 px-6 py-4">
            <h2 className="font-semibold text-stone-900">Purchase order history</h2>
          </div>

          {!orders.length ? (
            <p className="p-6 text-sm text-stone-500">No purchase orders created yet.</p>
          ) : (
            <div className="divide-y divide-stone-100">
              {orders.map((order) => {
                const orderLines = linesByOrder.get(order.id) ?? [];

                return (
                  <article key={order.id} className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-stone-900">{order.po_number}</p>
                          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold uppercase text-stone-600">
                            {order.status.replaceAll('_', ' ')}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-stone-500">
                          {supplierNames.get(order.supplier_id) || 'Supplier'} · KES {order.subtotal.toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs text-stone-400">
                          {order.expected_delivery ? `Expected ${order.expected_delivery}` : 'No delivery date set'}
                        </p>
                      </div>

                      <PurchaseOrderStatusControl
                        purchaseOrderId={order.id}
                        initialStatus={order.status}
                      />
                    </div>

                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      {orderLines.map((line) => (
                        <div key={line.id} className="rounded-xl bg-stone-50 p-3 text-sm">
                          <p className="font-medium text-stone-900">{line.description}</p>
                          <p className="mt-1 text-xs text-stone-500">
                            {line.quantity} {line.unit} · KES {line.line_total.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
