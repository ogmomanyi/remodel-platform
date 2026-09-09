'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/utils/supabase/admin';
import { calculateProposal, sourceToProposalLine } from '@/lib/proposals';
import type { MaterialReference } from '@/lib/material-types';

export async function createProposal(input: {
  projectSlug: string;
  title: string;
  currency: string;
  markupPercent: number;
  taxPercent: number;
  validUntil?: string;
  notes?: string;
  optionIds: string[];
}) {
  await requireAdmin();
  const supabase = createAdminClient();
  const title = input.title.trim() || 'Renovation Proposal';
  const currency = input.currency.trim().toUpperCase() || 'KES';
  const markupPercent = Number(input.markupPercent);
  const taxPercent = Number(input.taxPercent);
  if (!Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 500) throw new Error('Markup must be between 0% and 500%.');
  if (!Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100) throw new Error('Tax must be between 0% and 100%.');
  if (!Array.isArray(input.optionIds) || input.optionIds.length === 0) throw new Error('Select at least one design option.');

  const { data: project, error: projectError } = await supabase.from('projects').select('id, slug, project_code').eq('slug', input.projectSlug).maybeSingle();
  if (projectError || !project) throw new Error(`Could not load project: ${projectError?.message || 'project not found'}`);

  const { data: options, error: optionsError } = await supabase
    .from('design_options')
    .select('id, space_id, name, description, materials, cost_estimate, currency')
    .in('id', input.optionIds);
  if (optionsError) throw new Error(`Could not load design options: ${optionsError.message}`);
  if (!options?.length || options.length !== new Set(input.optionIds).size) throw new Error('One or more selected design options could not be found.');

  const spaceIds = [...new Set(options.map((o) => o.space_id))];
  const { data: spaces } = await supabase.from('project_spaces').select('id, name').in('id', spaceIds).eq('project_id', project.id);
  const spaceMap = new Map((spaces ?? []).map((s) => [s.id, s.name]));
  const sources = options.map((option) => ({
    spaceId: option.space_id,
    spaceName: spaceMap.get(option.space_id) || 'Space',
    optionId: option.id,
    optionName: option.name,
    optionDescription: option.description,
    optionBudget: option.cost_estimate,
    materials: Array.isArray(option.materials) ? option.materials as MaterialReference[] : [],
  }));
  const lines = sources.map((source) => sourceToProposalLine(source, markupPercent));
  const totals = calculateProposal(lines, taxPercent);

  const { data: latest } = await supabase.from('proposals').select('version').eq('project_id', project.id).order('version', { ascending: false }).limit(1).maybeSingle();
  const version = (latest?.version ?? 0) + 1;
  const proposalNumber = `${project.project_code}-P${version}`;

  const { data: proposal, error: proposalError } = await supabase.from('proposals').insert({
    project_id: project.id,
    proposal_number: proposalNumber,
    version,
    title,
    currency,
    markup_percent: markupPercent,
    tax_percent: taxPercent,
    subtotal: totals.subtotal,
    tax_amount: totals.taxAmount,
    total: totals.total,
    notes: input.notes?.trim() || null,
    valid_until: input.validUntil || null,
  }).select('id, proposal_number, version, title, status, currency, subtotal, tax_amount, total').single();
  if (proposalError || !proposal) throw new Error(`Could not create proposal: ${proposalError?.message || 'unknown database error'}`);

  const { error: lineError } = await supabase.from('proposal_lines').insert(lines.map((line, index) => ({
    proposal_id: proposal.id,
    project_space_id: line.spaceId,
    design_option_id: line.optionId,
    line_type: 'design_option',
    description: line.description,
    quantity: line.quantity,
    unit: line.unit,
    internal_unit_cost: line.internalUnitCost,
    selling_unit_price: line.sellingUnitPrice,
    internal_total: line.quantity * line.internalUnitCost,
    selling_total: line.quantity * line.sellingUnitPrice,
    source_snapshot: line.sourceSnapshot,
    sort_order: index,
  })));
  if (lineError) {
    await supabase.from('proposals').delete().eq('id', proposal.id);
    throw new Error(`Could not save proposal lines: ${lineError.message}`);
  }

  await supabase.from('project_events').insert({ project_id: project.id, event_type: 'proposal_created', metadata: { proposal_id: proposal.id, proposal_number: proposal.proposal_number, version, total: proposal.total } });
  revalidatePath(`/admin-dashboard/${project.slug}/proposal`);
  revalidatePath(`/admin-dashboard/${project.slug}/edit`);
  revalidatePath(`/${project.slug}`);
  revalidatePath('/admin-dashboard');
  return proposal;
}
