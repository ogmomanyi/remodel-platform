'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

const PO_STATUSES = ['draft', 'sent', 'ordered', 'partially_received', 'received', 'cancelled'] as const;
type PoStatus = typeof PO_STATUSES[number];

const PROCUREMENT_STATUS_BY_PO: Partial<Record<PoStatus, string>> = {
  ordered: 'ordered',
  partially_received: 'partially_received',
  received: 'received',
};

function revalidateProject(slug: string) {
  revalidatePath(`/admin-dashboard/${slug}/procurement`);
  revalidatePath(`/admin-dashboard/${slug}/procurement/orders`);
  revalidatePath(`/admin-dashboard/${slug}/execution`);
}

export async function createPurchaseOrder(input: {
  projectSlug: string;
  supplierId: string;
  itemIds: string[];
  expectedDelivery?: string;
  notes?: string;
}) {
  await requireAdmin();
  const supabase = createAdminClient();
  if (!input.supplierId) throw new Error('Select a supplier.');

  const itemIds = [...new Set(input.itemIds ?? [])].filter(Boolean);
  if (!itemIds.length) throw new Error('Select at least one procurement item.');

  const { data: project } = await supabase
    .from('projects')
    .select('id, slug, project_code')
    .eq('slug', input.projectSlug)
    .maybeSingle();
  if (!project) throw new Error('Project not found.');

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, name')
    .eq('id', input.supplierId)
    .eq('active', true)
    .maybeSingle();
  if (!supplier) throw new Error('Supplier not found or inactive.');

  const { data: items, error: itemsError } = await supabase
    .from('procurement_items')
    .select('id, project_id, description, quantity, unit, estimated_unit_cost, estimated_total, status, supplier_id')
    .in('id', itemIds)
    .eq('project_id', project.id);
  if (itemsError) throw new Error(`Could not load procurement items: ${itemsError.message}`);
  if (!items?.length || items.length !== itemIds.length) throw new Error('One or more procurement items could not be found.');
  if (items.some((item) => ['cancelled', 'received'].includes(item.status))) {
    throw new Error('Cancelled or already received items cannot be added to a new purchase order.');
  }

  const { data: existingLines, error: existingError } = await supabase
    .from('purchase_order_lines')
    .select('procurement_item_id, purchase_orders!inner(status)')
    .in('procurement_item_id', itemIds);
  if (existingError) throw new Error(`Could not check existing purchase orders: ${existingError.message}`);

  const allocated = (existingLines ?? []).filter((line) => {
    const po = Array.isArray(line.purchase_orders) ? line.purchase_orders[0] : line.purchase_orders;
    return po && po.status !== 'cancelled';
  });
  if (allocated.length) {
    throw new Error('One or more selected items are already allocated to an active purchase order.');
  }

  const { data: latest } = await supabase
    .from('purchase_orders')
    .select('po_number')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const last = latest?.po_number?.match(/-PO(\d+)$/)?.[1];
  const next = Number(last || 0) + 1;
  const poNumber = `${project.project_code}-PO${next}`;
  const subtotal = items.reduce((sum, item) => sum + Number(item.estimated_total || 0), 0);

  const { data: po, error: poError } = await supabase
    .from('purchase_orders')
    .insert({
      project_id: project.id,
      supplier_id: supplier.id,
      po_number: poNumber,
      currency: 'KES',
      subtotal,
      expected_delivery: input.expectedDelivery || null,
      notes: input.notes?.trim() || null,
    })
    .select('id, po_number')
    .single();

  if (poError || !po) {
    if (poError?.code === '23505') throw new Error('A purchase order was created at the same time. Please try again.');
    throw new Error(`Could not create purchase order: ${poError?.message || 'unknown error'}`);
  }

  const { error: lineError } = await supabase.from('purchase_order_lines').insert(
    items.map((item) => ({
      purchase_order_id: po.id,
      procurement_item_id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.estimated_unit_cost,
      line_total: item.estimated_total,
    })),
  );

  if (lineError) {
    await supabase.from('purchase_orders').delete().eq('id', po.id);
    throw new Error(`Could not create purchase order lines: ${lineError.message}`);
  }

  const { error: updateError } = await supabase
    .from('procurement_items')
    .update({ supplier_id: supplier.id, status: 'quoted', updated_at: new Date().toISOString() })
    .in('id', itemIds);
  if (updateError) throw new Error(`Could not link procurement items: ${updateError.message}`);

  await supabase.from('project_events').insert({
    project_id: project.id,
    event_type: 'purchase_order_created',
    metadata: {
      purchase_order_id: po.id,
      po_number: po.po_number,
      supplier_id: supplier.id,
      item_count: items.length,
      subtotal,
    },
  });

  revalidateProject(project.slug);
  return po;
}

export async function updatePurchaseOrderStatus(input: { purchaseOrderId: string; status: string }) {
  await requireAdmin();
  if (!PO_STATUSES.includes(input.status as PoStatus)) throw new Error('Invalid purchase order status.');

  const supabase = createAdminClient();
  const { data: po, error } = await supabase
    .from('purchase_orders')
    .select('id, project_id, status, po_number')
    .eq('id', input.purchaseOrderId)
    .maybeSingle();
  if (error || !po) throw new Error('Purchase order not found.');
  if (po.status === 'cancelled' || po.status === 'received') throw new Error('Closed purchase orders cannot be changed.');

  const nextStatus = input.status as PoStatus;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: nextStatus, updated_at: now };
  if (nextStatus === 'ordered' && po.status !== 'ordered') patch.ordered_at = now;

  const { error: updateError } = await supabase.from('purchase_orders').update(patch).eq('id', po.id);
  if (updateError) throw new Error(`Could not update purchase order: ${updateError.message}`);

  const { data: lines, error: lineError } = await supabase
    .from('purchase_order_lines')
    .select('procurement_item_id')
    .eq('purchase_order_id', po.id);
  if (lineError) throw new Error(`Could not load purchase order lines: ${lineError.message}`);

  const itemIds = (lines ?? []).map((line) => line.procurement_item_id).filter(Boolean);
  if (itemIds.length) {
    if (nextStatus === 'cancelled') {
      const { error: itemError } = await supabase
        .from('procurement_items')
        .update({ status: 'quoted', updated_at: now })
        .in('id', itemIds);
      if (itemError) throw new Error(`Could not release procurement items: ${itemError.message}`);
    } else {
      const procurementStatus = PROCUREMENT_STATUS_BY_PO[nextStatus];
      if (procurementStatus) {
        const { error: itemError } = await supabase
          .from('procurement_items')
          .update({ status: procurementStatus, updated_at: now })
          .in('id', itemIds);
        if (itemError) throw new Error(`Could not synchronize procurement items: ${itemError.message}`);
      }
    }
  }

  const { data: project } = await supabase.from('projects').select('slug').eq('id', po.project_id).maybeSingle();
  if (project) {
    await supabase.from('project_events').insert({
      project_id: po.project_id,
      event_type: 'purchase_order_status_updated',
      metadata: { purchase_order_id: po.id, po_number: po.po_number, from: po.status, status: nextStatus },
    });
    revalidateProject(project.slug);
  }
}
