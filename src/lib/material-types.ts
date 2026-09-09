export const MATERIAL_CATEGORIES = [
  'flooring',
  'wall_finish',
  'ceiling',
  'joinery',
  'furniture',
  'lighting',
  'hardware',
  'fabric_upholstery',
  'paint_colour',
  'sanitaryware',
  'other',
] as const;

export type MaterialCategory = (typeof MATERIAL_CATEGORIES)[number];

export type MaterialReference = {
  category: MaterialCategory;
  material: string;
  supplier?: string;
  product_reference?: string;
  quantity?: number | null;
  unit?: string;
  estimated_material_cost?: number | null;
  notes?: string;
};

export const EMPTY_MATERIAL_REFERENCE: MaterialReference = {
  category: 'other',
  material: '',
  supplier: '',
  product_reference: '',
  quantity: null,
  unit: '',
  estimated_material_cost: null,
  notes: '',
};
