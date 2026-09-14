'use client';

import { useMemo, useState } from 'react';
import {
  createVisualisationBrief,
  renderVisualisation,
  selectVisualisationVariant,
} from '@/app/admin-dashboard/visualisation-actions';
import { uploadProjectAsset } from '@/app/admin-dashboard/actions';

type Space = { id: string; name: string; space_type?: string | null };
type Moodboard = {
  id: string;
  name: string;
  project_space_id?: string | null;
  style_direction?: string | null;
  palette?: string[] | null;
};
type Concept = {
  id: string;
  name: string;
  project_space_id?: string | null;
  design_type?: string | null;
};
type Asset = {
  id: string;
  space_id?: string | null;
  kind: string;
  alt_text?: string | null;
  signed_url?: string | null;
};
type Visualisation = {
  id: string;
  name: string;
  status: string;
  project_space_id?: string | null;
  moodboard_id?: string | null;
  source_asset_id?: string | null;
  output_asset_id?: string | null;
  variant_key?: string | null;
  is_selected?: boolean;
  fidelity_mode?: 'concept' | 'site_accurate';
  brief_version?: number;
  created_at: string;
};
type RenderAsset = { id: string; signed_url?: string | null; alt_text?: string | null };

export default function VisualisationBriefStudio({
  projectId,
  projectSlug,
  spaces,
  moodboards,
  concepts,
  assets,
  visualisations,
  renderAssets = [],
}: {
  projectId: string;
  projectSlug: string;
  spaces: Space[];
  moodboards: Moodboard[];
  concepts: Concept[];
  assets: Asset[];
  visualisations: Visualisation[];
  renderAssets?: RenderAsset[];
}) {
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? '');
  const [moodboardId, setMoodboardId] = useState('');
  const [conceptId, setConceptId] = useState('');
  const [sourceAssetId, setSourceAssetId] = useState('');
  const [fidelityMode, setFidelityMode] = useState<'site_accurate' | 'concept'>('site_accurate');
  const [name, setName] = useState('Project visualisation');
  const [busy, setBusy] = useState(false);
  const [renderingId, setRenderingId] = useState('');
  const [selectingId, setSelectingId] = useState('');
  const [message, setMessage] = useState('');
  const [jobs, setJobs] = useState<Visualisation[]>(visualisations);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>(assets);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceCaption, setReferenceCaption] = useState('');
  const [uploadingReference, setUploadingReference] = useState(false);

  const filteredMoodboards = useMemo(
    () => moodboards.filter((m) => !spaceId || !m.project_space_id || m.project_space_id === spaceId),
    [moodboards, spaceId],
  );

  const filteredConcepts = useMemo(
    () => concepts.filter((c) => !spaceId || !c.project_space_id || c.project_space_id === spaceId),
    [concepts, spaceId],
  );

  const sourceAssets = useMemo(
    () => availableAssets.filter((a) => a.kind === 'site_photo' && (!spaceId || !a.space_id || a.space_id === spaceId)),
    [availableAssets, spaceId],
  );

  const selectedBoard = moodboards.find((m) => m.id === moodboardId);
  const outputById = useMemo(() => new Map(renderAssets.map((a) => [a.id, a])), [renderAssets]);

  const siteAccurateBlocked = fidelityMode === 'site_accurate' && !sourceAssetId;
  const referenceCoverage = useMemo(
    () => spaces.map((space) => ({
      ...space,
      count: availableAssets.filter((asset) => asset.kind === 'site_photo' && asset.space_id === space.id).length,
    })),
    [spaces, availableAssets],
  );

  async function uploadReference() {
    if (!referenceFile || !spaceId) return;
    setUploadingReference(true);
    setMessage('Uploading existing-condition reference…');
    try {
      const uploaded = await uploadProjectAsset({
        projectId,
        spaceId,
        kind: 'site_photo',
        altText: referenceCaption.trim() || 'Existing condition — ' + (spaces.find((space) => space.id === spaceId)?.name || 'project space'),
        file: referenceFile,
      });
      const asset = uploaded as Asset;
      setAvailableAssets((current) => [asset, ...current]);
      setSourceAssetId(asset.id);
      setReferenceFile(null);
      setReferenceCaption('');
      setMessage('Site reference uploaded and selected. Site-accurate rendering is now unlocked for this space.');
      const input = document.getElementById('visualisation-reference-file') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not upload site reference.');
    } finally {
      setUploadingReference(false);
    }
  }

  async function createBrief() {
    setBusy(true);
    setMessage('');
    try {
      const created = await createVisualisationBrief({
        projectSlug,
        name,
        spaceId: spaceId || null,
        moodboardId: moodboardId || null,
        designConceptId: conceptId || null,
        sourceAssetId: sourceAssetId || null,
        fidelityMode,
      });

      setJobs((current) => [created as Visualisation, ...current.filter((job) => job.id !== created.id)]);
      setMessage(
        fidelityMode === 'site_accurate'
          ? 'Site-accurate brief created. It is locked to the selected source photo and structured project brief.'
          : 'Concept brief created. Geometry is illustrative until a site reference is supplied.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create brief');
    } finally {
      setBusy(false);
    }
  }

  async function render(id: string, variantKey: string) {
    setRenderingId(id + ':' + variantKey);
    setMessage('Generating ' + variantKey + ' visualisation…');
    try {
      const result = await renderVisualisation({ visualisationId: id, variantKey });
      setJobs((current) =>
        current.map((job) =>
          job.id === id
            ? { ...job, status: 'ready', output_asset_id: result.assetId, variant_key: result.variantKey }
            : job,
        ),
      );
      setMessage('Render completed. Refresh the page to load the new image preview.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not render visualisation');
    } finally {
      setRenderingId('');
    }
  }

  async function select(id: string) {
    setSelectingId(id);
    setMessage('Selecting render for client presentation…');
    try {
      await selectVisualisationVariant({ visualisationId: id });
      setJobs((current) =>
        current.map((job) => ({
          ...job,
          is_selected: job.id === id ? true : job.project_space_id === current.find((item) => item.id === id)?.project_space_id ? false : job.is_selected,
        })),
      );
      setMessage('Selected render updated.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not select render');
    } finally {
      setSelectingId('');
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <aside className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Render preparation</p>
        <h2 className="mt-2 text-xl font-semibold text-stone-900">Build a constrained brief</h2>
        <p className="mt-1 text-sm leading-6 text-stone-500">
          The generator now reads the project brief, zone topology, measurements, recommended materials and moodboard automatically.
        </p>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Reference readiness</p>
              <span className="text-[11px] text-stone-400">
                {referenceCoverage.filter((item) => item.count > 0).length}/{referenceCoverage.length} zones ready
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {referenceCoverage.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate text-stone-700">{item.name}</span>
                  <span className={item.count > 0 ? 'rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700' : 'rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700'}>
                    {item.count > 0 ? item.count + ' reference' + (item.count === 1 ? '' : 's') : 'Needs photo'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <label className="block text-xs font-medium text-stone-500">
            Visualisation name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="block text-xs font-medium text-stone-500">
            Space
            <select
              value={spaceId}
              onChange={(event) => {
                setSpaceId(event.target.value);
                setMoodboardId('');
                setConceptId('');
                setSourceAssetId('');
              }}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">Whole project</option>
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>{space.name}</option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-xs font-medium text-stone-500">Fidelity mode</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFidelityMode('site_accurate')}
                className={`rounded-xl border px-3 py-3 text-left text-xs ${fidelityMode === 'site_accurate' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600'}`}
              >
                <span className="block font-semibold">Site-accurate</span>
                <span className="mt-1 block opacity-75">Preserve real architecture</span>
              </button>
              <button
                type="button"
                onClick={() => setFidelityMode('concept')}
                className={`rounded-xl border px-3 py-3 text-left text-xs ${fidelityMode === 'concept' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 bg-white text-stone-600'}`}
              >
                <span className="block font-semibold">Concept</span>
                <span className="mt-1 block opacity-75">Exploratory only</span>
              </button>
            </div>
          </div>

          <label className="block text-xs font-medium text-stone-500">
            Moodboard
            <select
              value={moodboardId}
              onChange={(event) => setMoodboardId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">Use project brief only</option>
              {filteredMoodboards.map((moodboard) => (
                <option key={moodboard.id} value={moodboard.id}>
                  {moodboard.name}{moodboard.style_direction ? ' · ' + moodboard.style_direction : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-stone-500">
            Spatial concept
            <select
              value={conceptId}
              onChange={(event) => setConceptId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">Use project brief only</option>
              {filteredConcepts.map((concept) => (
                <option key={concept.id} value={concept.id}>{concept.name}</option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-stone-500">
            Existing site photo
            <select
              value={sourceAssetId}
              onChange={(event) => setSourceAssetId(event.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">No reference selected</option>
              {sourceAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>{asset.alt_text || 'Site photo'}</option>
              ))}
            </select>
          </label>

          {spaceId && (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-4">
              <p className="text-xs font-semibold text-stone-700">Attach an existing-condition photo</p>
              <p className="mt-1 text-[11px] leading-5 text-stone-500">
                Use a clear view that preserves the architecture and camera perspective you want the proposed render to follow.
              </p>
              <input
                id="visualisation-reference-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setReferenceFile(event.target.files?.[0] ?? null)}
                className="mt-3 block w-full text-xs text-stone-600"
              />
              <input
                value={referenceCaption}
                onChange={(event) => setReferenceCaption(event.target.value)}
                placeholder="e.g. Section B facing garden — right corner visible"
                className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={uploadReference}
                disabled={!referenceFile || uploadingReference}
                className="mt-3 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 disabled:opacity-40"
              >
                {uploadingReference ? 'Uploading…' : 'Upload & use this reference'}
              </button>
            </div>
          )}

          {fidelityMode === 'site_accurate' && sourceAssets.length === 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
              No site photo is attached to this space yet. Upload one here to unlock site-accurate rendering.
            </div>
          )}

          {fidelityMode === 'concept' && (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs leading-5 text-stone-600">
              Concept mode follows the written brief but may infer geometry. It should not be used as a client claim of the exact finished architecture.
            </div>
          )}

          <button
            onClick={createBrief}
            disabled={busy || !name.trim() || siteAccurateBlocked}
            className="w-full rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? 'Creating…' : fidelityMode === 'site_accurate' ? 'Create site-accurate brief' : 'Create concept brief'}
          </button>

          {message && <p className="text-xs font-medium leading-5 text-stone-600">{message}</p>}
        </div>
      </aside>

      <div className="space-y-6">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Selected direction</p>
              <h3 className="mt-1 text-2xl font-semibold text-stone-900">
                {selectedBoard?.name || 'Structured project brief'}
              </h3>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
              {fidelityMode === 'site_accurate' ? 'Site-accurate' : 'Concept'}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(selectedBoard?.palette || []).map((colour, index) => (
              <span
                key={colour + '-' + index}
                title={colour}
                className="h-12 w-12 rounded-full border border-white shadow"
                style={{ background: colour }}
              />
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-stone-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Constrained pipeline</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              {['Site reference', 'Project brief', 'Zone + quantities', 'Constrained render', 'Client selection'].map((step, index) => (
                <div key={step} className="rounded-xl border border-stone-200 bg-white p-3">
                  <span className="text-[10px] text-stone-400">0{index + 1}</span>
                  <p className="mt-1 text-xs font-medium text-stone-700">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-stone-900">Visualisation jobs</h3>
            <span className="text-xs text-stone-400">{jobs.length} briefs</span>
          </div>

          <div className="mt-4 space-y-3">
            {jobs.length ? jobs.map((job) => {
              const output = job.output_asset_id ? outputById.get(job.output_asset_id) : null;
              const renderKey = job.id + ':' + (job.variant_key || 'primary');

              return (
                <div key={job.id} className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-stone-800">{job.name}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${job.fidelity_mode === 'site_accurate' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {job.fidelity_mode === 'site_accurate' ? 'Site-accurate' : 'Concept'}
                        </span>
                        {job.brief_version && (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] text-stone-400">Brief v{job.brief_version}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-stone-400">
                        {job.variant_key || 'primary'} · {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600">{job.status}</span>
                      {job.is_selected && (
                        <span className="rounded-full bg-stone-900 px-3 py-1 text-xs font-medium text-white">Selected</span>
                      )}
                      {(job.status === 'brief' || job.status === 'failed') && (
                        <button
                          onClick={() => render(job.id, 'primary')}
                          disabled={Boolean(renderingId)}
                          className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {renderingId === renderKey ? 'Rendering…' : job.status === 'failed' ? 'Retry' : 'Render'}
                        </button>
                      )}
                      {job.status === 'ready' && !job.is_selected && (
                        <button
                          onClick={() => select(job.id)}
                          disabled={Boolean(selectingId)}
                          className="rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 disabled:opacity-50"
                        >
                          {selectingId === job.id ? 'Selecting…' : 'Use for client'}
                        </button>
                      )}
                    </div>
                  </div>

                  {output?.signed_url && (
                    <div className="mt-4 overflow-hidden rounded-2xl bg-stone-900">
                      <img
                        src={output.signed_url}
                        alt={output.alt_text || job.name}
                        className="aspect-video w-full object-cover"
                      />
                    </div>
                  )}

                  {job.status === 'ready' && !job.is_selected && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['warm', 'light', 'editorial'].map((variant) => (
                        <button
                          key={variant}
                          onClick={() => render(job.id, variant)}
                          disabled={Boolean(renderingId)}
                          className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium capitalize text-stone-600"
                        >
                          {variant} variant
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            }) : (
              <p className="py-8 text-center text-sm text-stone-400">No visualisation briefs yet.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
