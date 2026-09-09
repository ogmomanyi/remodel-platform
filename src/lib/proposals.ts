import type { MaterialReference } from '@/lib/material-types';

export type ProposalSource = {
  spaceId: string;
  spaceName: string;
  optionId: string;
  optionName: string;
  optionDescription: string | null;
  optionBudget: number | null;
  materials: MaterialReference[];
};

export type ProposalLineDraft = {
  spaceId: string;
  spaceName: string;
  optionId: string;
  optionName: string;
  description: string;
  quantity: number;
  unit: string;
  internalUnitCost: number;
  sellingUnitPrice: number;
  sourceSnapshot: Record<string, unknown>;
};

export function materialCost(materials: MaterialReference[] | null | undefined) {
  return (materials ?? []).reduce((sum, item) => {
    const quantity = item.quantity == null ? null : Number(item.quantity);
    const unitCost = item.estimated_material_cost == null ? null : Number(item.estimated_material_cost);
    return quantity != null && unitCost != null && Number.isFinite(quantity) && Number.isFinite(unitCost)
      ? sum + quantity * unitCost
      : sum;
  }, 0);
}

export function sourceToProposalLine(source: ProposalSource, markupPercent: number): ProposalLineDraft {
  const internal = materialCost(source.materials);
  const basis = internal > 0 ? internal : Number(source.optionBudget ?? 0);
  const selling = basis * (1 + markupPercent / 100);
  return {
    spaceId: source.spaceId,
    spaceName: source.spaceName,
    optionId: source.optionId,
    optionName: source.optionName,
    description: source.optionDescription || source.optionName,
    quantity: 1,
    unit: 'option',
    internalUnitCost: roundMoney(basis),
    sellingUnitPrice: roundMoney(selling),
    sourceSnapshot: {
      space_name: source.spaceName,
      option_name: source.optionName,
      option_description: source.optionDescription,
      option_budget: source.optionBudget,
      materials: source.materials,
    },
  };
}

export function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateProposal(lines: Array<Pick<ProposalLineDraft, 'quantity' | 'internalUnitCost' | 'sellingUnitPrice'>>, taxPercent: number) {
  const internalTotal = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.internalUnitCost, 0));
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.sellingUnitPrice, 0));
  const taxAmount = roundMoney(subtotal * taxPercent / 100);
  return { internalTotal, subtotal, taxAmount, total: roundMoney(subtotal + taxAmount) };
}
