# Visual Catalogue Product Specification

## Product goal

The platform must turn a renovation project into a polished, client-ready architectural visual catalogue. The benchmark is the 12-page Lower Kabete catalogue supplied by the user.

The platform is not primarily an AI-art generator. It is a structured catalogue system that combines:

- one approved master concept;
- zone-specific supporting visuals;
- project scope and quantities;
- quoted work packages and commercial values;
- diagrams/plans;
- client-facing narratives and key features;
- a consistent editorial layout;
- exportable client presentation output.

## Core principle

One approved master concept governs geometry and design intent across the catalogue.

Supporting visuals may vary viewpoint, crop, lighting, detail or emphasis, but must not silently change:

- project footprint;
- zone relationships;
- permanent architecture;
- opening locations;
- roof geometry;
- garden-access logic;
- approved material language;
- client-approved spatial intent.

## Catalogue workflow

1. Project intake
   - project identity
   - client
   - property
   - quotation / scope
   - quantities
   - zones / spaces
   - site photos, sketch and plans

2. Master concept
   - generate or upload proposed master visual
   - compare against brief
   - internal review
   - approve geometry/design intent
   - lock as catalogue master

3. Supporting visuals
   - derive zone views/details from approved master
   - use site photos where available
   - create plan/diagram assets
   - select material/detail images

4. Catalogue assembly
   - populate 12 fixed page templates
   - bind live project data
   - assign required assets
   - edit captions/narratives where needed

5. Internal review
   - completeness check
   - commercial values check
   - quantity check
   - visual consistency check
   - client-safe render check

6. Client-ready
   - all required pages complete
   - master concept approved
   - no concept-only placeholders in client-facing slots
   - disclaimers present

7. Publish/export
   - authenticated client web catalogue
   - print/PDF export
   - versioned catalogue record

## Page templates

### Page 1 — Cover
Template key: `cover`

Required:
- approved hero/master image
- project title
- catalogue title
- short scope line
- brand
- quoted contract sum
- currency

Data bindings:
- project identity
- catalogue metadata
- quoted contract value

### Page 2 — Approved Concept
Template key: `approved-concept`

Required:
- approved master visual
- plan/layout inset
- zone callouts
- design-intent disclaimer

Rule:
- this page establishes the geometry used throughout the catalogue.

### Page 3 — Project Overview
Template key: `project-overview`

Required:
- work-package summary cards
- construction sequence
- preliminaries
- total contract sum

Data bindings:
- work packages
- project stages
- quoted values

### Page 4 — Zone A
Template key: `zone-focus`

Required:
- hero view
- supporting view
- detail view
- zone narrative
- key features

Bound to:
- Veranda Section A

### Page 5 — Zone B
Template key: `zone-focus`

Required:
- connector hero/detail
- geometry notes
- garden-access relationship
- feature list

Bound to:
- Central Connecting Veranda

### Page 6 — Zone C
Template key: `zone-focus`

Required:
- hero view
- supporting/detail views
- glazing/door relationship
- zone narrative

Bound to:
- Veranda Section B

### Page 7 — Planter / Boundary / Garden Access
Template key: `detail-board`

Required:
- garden-edge hero/detail
- plan inset
- wall/planter construction logic
- access break logic

Bound to:
- Boundary Wall & Planter Edge

### Page 8 — Canopy / Roofing / Glazing Work Package
Template key: `work-package`

Required:
- relevant hero/detail image
- removals
- structural sections
- base plates/bolts
- laminated glass quantity
- paint specification
- work-package total

### Page 9 — Aluminium Glazing / Door Systems
Template key: `work-package`

Required:
- supporting/detail visuals
- frame specification
- glass specification
- quoted area
- door specification
- closer / ironmongery
- work-package total

### Page 10 — Floor Finishes
Template key: `work-package`

Required:
- material visual
- installed-context visual
- floor quantity
- tile format/spec
- skirting length
- thresholds / steps note
- work-package total

### Page 11 — Internal Work
Template key: `before-after`

Required:
- before image
- after/proposed image
- scope bullets
- site-setting-out note
- work-package total

Bound to:
- Interior Wall Modification

### Page 12 — Commercial Summary
Template key: `commercial-summary`

Required:
- work-package table
- preliminaries
- total contract sum
- catalogue disclaimer
- client-presentation footer

## Database model

### presentation_catalogues

Purpose: one versioned client catalogue per project/version.

Fields:
- id
- project_id
- name
- version
- status
- title
- subtitle
- brand_name
- brand_tagline
- theme_key
- quoted_contract_sum
- currency
- master_visualisation_id
- master_asset_id
- cover_asset_id
- metadata
- created_at
- updated_at

Status:
- draft
- internal_review
- client_ready
- published
- archived

### presentation_boards

Purpose: one catalogue page.

Key fields:
- catalogue_id
- project_id
- project_space_id
- board_code
- page_number
- title
- subtitle
- board_type
- template_key
- section_label
- eyebrow
- narrative
- key_features
- layout_spec
- content_json
- data_bindings
- approval_status
- status
- client_visible
- sort_order

### presentation_board_assets

Purpose: assign visual/media assets to page slots.

Roles:
- hero
- support
- detail
- plan
- before
- after
- material
- logo
- diagram
- reference

## Master concept requirements

A catalogue master visual must:
- be explicitly approved;
- be stored in `presentation_catalogues.master_visualisation_id`;
- have an associated `master_asset_id`;
- represent the accepted geometry and design intent;
- be used as the visual consistency reference for subsequent pages.

No page should be considered client-ready if its proposed visuals contradict the approved master concept.

## Data-binding rules

Commercial and quantity pages should be driven from structured project data rather than manually retyped values.

Examples:
- contract sum -> catalogue/project commercial data
- floor area -> quoted quantity
- glazing area -> quoted quantity
- steel quantities -> quoted BOQ / structured quantity data
- zone description -> project space / design option
- material specification -> recommended option/material data

Manual page text is allowed for narrative and captions, but structured figures should have one source of truth.

## Visual safety classes

### Site-accurate
May be client-facing when:
- source site photo exists;
- brief version >= 3;
- render completed successfully;
- visual has been internally approved.

### Approved master concept
May be client-facing when:
- intentionally approved as design intent;
- geometry is locked;
- labelled as design intent, not measured construction drawing.

### Concept-only
Internal/exploratory by default.
Cannot automatically satisfy client-facing render slots.

## Required platform features

### Catalogue workspace
- list pages in order
- show page number/template
- show required slots
- show missing assets/data
- show page approval status
- preview page
- attach/detach assets
- edit narrative/captions
- mark page reviewed/approved

### Master concept workflow
- nominate visual as master
- preview alongside project brief
- approve/replace master
- show which pages depend on it

### Structured content
- work-package table
- quantities
- totals
- preliminaries
- feature bullets
- construction sequence
- material specifications

### Export
- render catalogue pages consistently
- generate PDF
- include page numbers/branding
- preserve high-resolution assets
- version exported catalogues

## Acceptance criteria

The catalogue system is successful when:

1. A project can be turned into a complete 12-page catalogue without manually rebuilding layouts in an external design tool.
2. A single approved master visual governs the rest of the catalogue.
3. Commercial and quantity figures come from structured project data.
4. Pages clearly show missing inputs before publication.
5. Client-facing pages cannot accidentally use broken/deleted assets.
6. Concept-only renders cannot silently masquerade as approved site-accurate visuals.
7. The final web/PDF output looks like a coherent architectural presentation rather than a gallery of AI images.
8. A new project can reuse the same catalogue templates with different content.

## Lower Kabete implementation

Catalogue:
- Lower Kabete Client Visual Catalogue
- Version 1
- 12 pages
- current status: draft
- quoted contract sum: KES 3,158,300

The current project uses the supplied PDF as the capability benchmark. Project-specific design facts remain bound to the live project brief unless explicitly revised by the user.
