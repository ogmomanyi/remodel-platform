'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';

export async function createProcurementFromProposal(proposalId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { data: proposal, error: proposalError } = await supabase
    .from('proposals')
    .select('id, project_id, proposal_number, status')
    .eq('id', proposalId)
    .maybeSingle();
  if (proposalError || !proposal) throw new Error(`Proposal not found: ${proposalError?.message || 'unknown error'}`);
  if (proposal.status !== 'approved') throw new Error('Only an approved proposal can be converted to procurement.');

  const { data: project } = await supabase.from('projects').select('id, slug').eq('id', proposal.project_id).maybeSingle();
  if (!project) throw new Error('Project not found.');

  const { data: lines, error: lineError } = await supabase
    .from('proposal_lines')
    .select('id, project_space_id, design_option_id, line_type, description, quantity, unit, internal_unit_cost, source_snapshot')
    .eq('proposal_id', proposal.id)
    .order('sort_order');
  if (lineError) throw new Error(`Could not load proposal lines: ${lineError.message}`);

  let created = 0;
  for (const line of lines ?? []) {
    const snapshot = line.source_snapshot && typeof line.source_snapshot === 'object' ? line.source_snapshot as Record<string, unknown> : {};
    const materials = Array.isArray(snapshot.materials) ? snapshot.materials : [];

    if (materials.length > 0) {
      for (const rawMaterial of materials) {
        if (!rawMaterial || typeof rawMaterial !== 'object') continue;
        const material = rawMaterial as Record<string, unknown>;
        const description = String(material.material || '').trim();
        if (!description) continue;
        const quantity = Number(material.quantity ?? 0);
        const unitCost = Number(material.estimated_material_cost ?? 0);
        const safeQuantity = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
        const safeUnitCost = Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0;
        const { error } = await supabase.from('procurement_items').upsert({
          project_id: project.id,
          proposal_id: proposal.id,
          proposal_line_id: line.id,
          design_option_id: line.design_option_id,
          project_space_id: line.project_space_id,
          item_type: 'material',
          description,
          quantity: safeQuantity,
          unit: String(material.unit || 'item'),
          estimated_unit_cost: safeUnitCost,
          estimated_total: safeQuantity * safeUnitCost,
          source_snapshot: { proposal_line: line, material },
          updated_at: new Date().toISOString(),
        }, { onConflict: 'proposal_id,proposal_line_id,description' });
        if (error) throw new Error(`Could not create procurement item: ${error.message}`);
        created += 1;
      }
    } else {
      const quantity = Number(line.quantity ?? 1);
      const unitCost = Number(line.internal_unit_cost ?? 0);
      const { error } = await supabase.from('procurement_items').upsert({
        project_id: project.id,
        proposal_id: proposal.id,
        proposal_line_id: line.id,
        design_option_id: line.design_option_id,
        project_space_id: line.project_space_id,
        item_type: line.line_type === 'service' ? 'service' : 'package',
        description: line.description,
        quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
        unit: line.unit || 'item',
        estimated_unit_cost: Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0,
        estimated_total: (Number.isFinite(quantity) && quantity >= 0 ? quantity : 0) * (Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0),
        source_snapshot: { proposal_line: line },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'proposal_id,proposal_line_id,description' });
      if (error) throw new Error(`Could not create procurement item: ${error.message}`);
      created += 1;
    }
  }

  await supabase.from('project_events').insert({
    project_id: project.id,
    event_type: 'procurement_created_from_proposal',
    metadata: { proposal_id: proposal.id, proposal_number: proposal.proposal_number, item_count: created },
  });
  revalidatePath(`/admin-dashboard/${project.slug}/procurement`);
  revalidatePath(`/admin-dashboard/${project.slug}/proposal`);
  return { created };
}

export async function updateProcurementStatus(input: { itemId: string; status: string }) {
  await requireAdmin();
  const allowed = ['planned', 'quoted', 'ordered', 'partially_received', 'received', 'cancelled'];
  if (!allowed.includes(input.status)) throw new Error('Invalid procurement status.');
  const supabase = createAdminClient();
  const { data: item, error } = await supabase.from('procurement_items').select('id, project_id').eq('id', input.itemId).maybeSingle();
  if (error || !item) throw new Error(`Procurement item not found: ${error?.message || 'unknown error'}`);
  const { error: updateError } = await supabase.from('procurement_items').update({ status: input.status, updated_at: new Date().toISOString() }).eq('id', item.id);
  if (updateError) throw new Error(`Could not update procurement status: ${updateError.message}`);
  const { data: project } = await supabase.from('projects').select('slug').eq('id', item.project_id).maybeSingle();
  if (project) revalidatePath(`/admin-dashboard/${project.slug}/procurement`);
}
