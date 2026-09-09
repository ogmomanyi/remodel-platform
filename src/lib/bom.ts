import type { MaterialReference } from '@/lib/material-types';

export type BomLine = MaterialReference & {
  line_cost: number | null;
};

export type BomSummary = {
  lines: BomLine[];
  priced_lines: number;
  material_total: number;
  unpriced_lines: number;
};

export function buildBom(materials: MaterialReference[] | null | undefined): BomSummary {
  const lines = (Array.isArray(materials) ? materials : [])
    .filter((item) => item && String(item.material || '').trim())
    .map((item) => {
      const quantity = item.quantity == null ? null : Number(item.quantity);
      const unitCost = item.estimated_material_cost == null ? null : Number(item.estimated_material_cost);
      const lineCost = quantity != null && unitCost != null && Number.isFinite(quantity) && Number.isFinite(unitCost)
        ? quantity * unitCost
        : null;
      return { ...item, line_cost: lineCost };
    });

  return {
    lines,
    priced_lines: lines.filter((line) => line.line_cost != null).length,
    material_total: lines.reduce((sum, line) => sum + (line.line_cost ?? 0), 0),
    unpriced_lines: lines.filter((line) => line.line_cost == null).length,
  };
}
