'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

const PO_STATUSES = ['draft', 'sent', 'ordered', 'partially_received', 'received', 'cancelled'] as const;
type PoStatus = typeof PO_STATUSES[number];

export async function createPurchaseOrder(input: { projectSlug: string; supplierId: string; itemIds: string[]; expectedDelivery?: string; notes?: string }) {
  await requireAdmin();
  const supabase = createAdminClient();
  if (!input.supplierId) throw new Error('Select a supplier.');
  const itemIds = [...new Set(input.itemIds ?? [])].filter(Boolean);
  if (!itemIds.length) throw new Error('Select at least one procurement item.');

  const { data: project } = await supabase.from('projects').select('id, slug, project_code').eq('slug', input.projectSlug).maybeSingle();
  if (!project) throw new Error('Project not found.');
  const { data: supplier } = await supabase.from('suppliers').select('id, name').eq('id', input.supplierId).eq('active', true).maybeSingle();
  if (!supplier) throw new Error('Supplier not found or inactive.');
  const { data: items, error: itemsError } = await supabase.from('procurement_items').select('id, project_id, description, quantity, unit, estimated_unit_cost, estimated_total, status, supplier_id').in('id', itemIds).eq('project_id', project.id);
  if (itemsError) throw new Error(`Could not load procurement items: ${itemsError.message}`);
  if (!items?.length || items.length !== itemIds.length) throw new Error('One or more procurement items could not be found.');
  if (items.some(item => ['cancelled', 'received'].includes(item.status))) throw new Error('Cancelled or already received items cannot be added to a new purchase order.');

  const { data: latest } = await supabase.from('purchase_orders').select('po_number').eq('project_id', project.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const last = latest?.po_number?.match(/-PO(\d+)$/)?.[1];
  const next = Number(last || 0) + 1;
  const poNumber = `${project.project_code}-PO${next}`;
  const subtotal = items.reduce((sum, item) => sum + Number(item.estimated_total || 0), 0);

  const { data: po, error: poError } = await supabase.from('purchase_orders').insert({ project_id: project.id, supplier_id: supplier.id, po_number: poNumber, currency: 'KES', subtotal, expected_delivery: input.expectedDelivery || null, notes: input.notes?.trim() || null }).select('id, po_number').single();
  if (poError || !po) throw new Error(`Could not create purchase order: ${poError?.message || 'unknown error'}`);

  const { error: lineError } = await supabase.from('purchase_order_lines').insert(items.map(item => ({ purchase_order_id: po.id, procurement_item_id: item.id, description: item.description, quantity: item.quantity, unit: item.unit, unit_cost: item.estimated_unit_cost, line_total: item.estimated_total })));
  if (lineError) { await supabase.from('purchase_orders').delete().eq('id', po.id); throw new Error(`Could not create purchase order lines: ${lineError.message}`); }
  const { error: updateError } = await supabase.from('procurement_items').update({ supplier_id: supplier.id, status: 'quoted', updated_at: new Date().toISOString() }).in('id', itemIds);
  if (updateError) throw new Error(`Could not link procurement items: ${updateError.message}`);
  await supabase.from('project_events').insert({ project_id: project.id, event_type: 'purchase_order_created', metadata: { purchase_order_id: po.id, po_number: po.po_number, supplier_id: supplier.id, item_count: items.length, subtotal } });
  revalidatePath(`/admin-dashboard/${project.slug}/procurement`);
  revalidatePath(`/admin-dashboard/${project.slug}/procurement/orders`);
  return po;
}

export async function updatePurchaseOrderStatus(input: { purchaseOrderId: string; status: string }) {
  await requireAdmin();
  if (!PO_STATUSES.includes(input.status as PoStatus)) throw new Error('Invalid purchase order status.');
  const supabase = createAdminClient();
  const { data: po, error } = await supabase.from('purchase_orders').select('id, project_id, status, po_number').eq('id', input.purchaseOrderId).maybeSingle();
  if (error || !po) throw new Error('Purchase order not found.');
  if (po.status === 'cancelled' || po.status === 'received') throw new Error('Closed purchase orders cannot be changed.');
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: input.status, updated_at: now };
  if (input.status === 'ordered') patch.ordered_at = now;
  const { error: updateError } = await supabase.from('purchase_orders').update(patch).eq('id', po.id);
  if (updateError) throw new Error(`Could not update purchase order: ${updateError.message}`);
  if (input.status === 'ordered') {
    const { data: lines } = await supabase.from('purchase_order_lines').select('procurement_item_id').eq('purchase_order_id', po.id);
    if (lines?.length) await supabase.from('procurement_items').update({ status: 'ordered', updated_at: now }).in('id', lines.map(line => line.procurement_item_id));
  }
  const { data: project } = await supabase.from('projects').select('slug').eq('id', po.project_id).maybeSingle();
  if (project) { await supabase.from('project_events').insert({ project_id: po.project_id, event_type: 'purchase_order_status_updated', metadata: { purchase_order_id: po.id, po_number: po.po_number, status: input.status } }); revalidatePath(`/admin-dashboard/${project.slug}/procurement`); revalidatePath(`/admin-dashboard/${project.slug}/procurement/orders`); }
}
