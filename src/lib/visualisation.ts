export type VisualisationInput = {
  spaceName: string;
  spaceType?: string | null;
  direction: string;
  palette: string[];
  moodboardDescription?: string | null;
  moodboardNotes?: string | null;
  materialReferences: string[];
  designElements: Array<{
    type: string;
    label?: string;
    material?: string;
    finish?: string;
    width?: number;
    height?: number;
  }>;
};

export function buildVisualisationPrompt(input: VisualisationInput) {
  const room = input.spaceName || 'the space';
  const type = input.spaceType ? ` ${input.spaceType.replace(/_/g, ' ')}` : '';
  const palette = input.palette.filter(Boolean).join(', ') || 'a restrained neutral palette';
  const materials = input.materialReferences.filter(Boolean).join(', ') || 'materials consistent with the moodboard';
  const elements = input.designElements
    .slice(0, 100)
    .map((element) => [element.type, element.label, element.material, element.finish].filter(Boolean).join(' — '))
    .filter(Boolean)
    .join('; ');

  return [
    `Create a high-end, photorealistic interior design visualisation of ${room}${type}.`,
    `Design direction: ${input.direction}.`,
    `Colour palette: ${palette}.`,
    `Material references: ${materials}.`,
    input.moodboardDescription ? `Moodboard description: ${input.moodboardDescription}.` : '',
    input.moodboardNotes ? `Designer notes: ${input.moodboardNotes}.` : '',
    elements ? `Spatial concept elements to preserve and interpret: ${elements}.` : '',
    'Preserve realistic room proportions, believable architectural details, natural material texture and practical furniture scale.',
    'Use premium editorial interior-photography composition, natural depth, realistic shadows and physically plausible lighting.',
    'Do not invent extra windows, doors or structural openings that contradict the source space.',
  ].filter(Boolean).join('\n');
}

export function buildNegativePrompt() {
  return [
    'cartoon',
    'illustration',
    'low-poly',
    'plastic CGI',
    'over-smoothed textures',
    'warped architecture',
    'floating furniture',
    'duplicate furniture',
    'extra windows',
    'extra doors',
    'incorrect perspective',
    'distorted proportions',
    'text overlays',
    'watermarks',
  ].join(', ');
}
