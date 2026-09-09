export const DESIGN_ELEMENT_TYPES = [
  'room',
  'wall',
  'window',
  'door',
  'sofa',
  'table',
  'plant',
  'text',
] as const;

export type DesignElementType = (typeof DESIGN_ELEMENT_TYPES)[number];

export type DesignElement = {
  id: string;
  type: DesignElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  label?: string;
  finish?: string;
  accent?: string;
  material?: string;
};

export type PersistedDesign = {
  id: string;
  name: string;
  elements: DesignElement[];
  version: number;
  updated_at: string;
  space_id?: string | null;
};
