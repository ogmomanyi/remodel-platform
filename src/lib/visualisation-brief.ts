export type StructuredVisualisationBrief = {
  version: number;
  fidelityMode: 'concept' | 'site_accurate';
  project: {
    code: string;
    clientName: string;
    description: string | null;
  };
  space: null | {
    id: string;
    name: string;
    type: string;
    existingNotes: string | null;
    measurements: Record<string, unknown>;
  };
  topology: {
    canonicalFiveZone: boolean;
    zone: string | null;
    sketchPosition: string | null;
    topologyRule: string | null;
  };
  designOptions: Array<{
    name: string;
    description: string | null;
    materials: unknown[];
  }>;
  moodboard: null | {
    name: string;
    direction: string | null;
    palette: string[];
    description: string | null;
    notes: string | null;
    references: string[];
  };
  spatialConcept: null | {
    name: string;
    elements: unknown[];
  };
  sourceReference: null | {
    id: string;
    caption: string | null;
    kind: string;
  };
  nonNegotiables: string[];
};

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function buildBriefConstrainedPrompt(brief: StructuredVisualisationBrief) {
  const spaceName = brief.space?.name || 'whole project';
  const measurements = brief.space?.measurements || {};

  return [
    'ARCHITECTURAL VISUALISATION — BRIEF-CONSTRAINED MODE',
    '',
    'This is NOT an open-ended image-generation task. Treat the structured project brief below as construction/design constraints.',
    'Do not improvise a different building, footprint, room topology, opening layout, roof form, or circulation pattern.',
    brief.fidelityMode === 'site_accurate'
      ? 'SOURCE-IMAGE RULE: Preserve the supplied source image camera position, perspective, permanent architecture, proportions, roof geometry, wall geometry and unaffected openings. Edit only the scope explicitly permitted by the brief.'
      : 'CONCEPT MODE: No site image is supplied. The result is conceptual only and must still obey all stated topology, dimensions and scope constraints.',
    '',
    'TARGET SPACE: ' + spaceName,
    '',
    'NON-NEGOTIABLE CONSTRAINTS:',
    ...brief.nonNegotiables.map((item, index) => String(index + 1) + '. ' + item),
    '',
    'STRUCTURED PROJECT BRIEF:',
    compactJson({
      project: brief.project,
      space: brief.space,
      topology: brief.topology,
      quoted_and_derived_measurements: measurements,
      recommended_design_options: brief.designOptions,
      moodboard: brief.moodboard,
      spatial_concept: brief.spatialConcept,
      source_reference: brief.sourceReference,
    }),
    '',
    'OUTPUT REQUIREMENTS:',
    '- Photorealistic, premium residential architectural photography.',
    '- Realistic Kenyan daylight and believable material behavior.',
    '- Accurate scale and buildable detailing.',
    '- Preserve all unaffected existing architecture.',
    '- Do not add doors, windows, walls, roofs, fireplaces, stairs or extensions unless explicitly required above.',
    '- Do not merge distinct zones that the brief keeps separate.',
    '- No text, labels, watermarks or diagram annotations in the render.',
  ].join('\\n');
}

export function buildBriefNegativePrompt() {
  return [
    'generic luxury villa',
    'invented architecture',
    'changed building footprint',
    'changed roof geometry',
    'extra windows',
    'extra doors',
    'extra rooms',
    'merged veranda zones',
    'commercial curtain wall',
    'oversized structural members',
    'oversized fireplace',
    'floating elements',
    'warped architecture',
    'incorrect perspective',
    'distorted proportions',
    'cartoon',
    'illustration',
    'plastic CGI',
    'text',
    'labels',
    'watermark',
  ].join(', ');
}
