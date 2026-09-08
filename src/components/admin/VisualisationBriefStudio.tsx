'use client';

import { useMemo, useState } from 'react';
import { createVisualisationBrief, renderVisualisation } from '@/app/admin-dashboard/visualisation-actions';

type Space = { id: string; name: string; space_type?: string | null };
type Moodboard = { id: string; name: string; project_space_id?: string | null; style_direction?: string | null; palette?: string[] | null };
type Concept = { id: string; name: string; project_space_id?: string | null; design_type?: string | null };
type Asset = { id: string; space_id?: string | null; kind: string; alt_text?: string | null; signed_url?: string | null };
type Visualisation = { id: string; name: string; status: string; project_space_id?: string | null; moodboard_id?: string | null; created_at: string };

export default function VisualisationBriefStudio({ projectSlug, spaces, moodboards, concepts, assets, visualisations }: { projectSlug: string; spaces: Space[]; moodboards: Moodboard[]; concepts: Concept[]; assets: Asset[]; visualisations: Visualisation[] }) {
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? '');
  const [moodboardId, setMoodboardId] = useState('');
  const [conceptId, setConceptId] = useState('');
  const [sourceAssetId, setSourceAssetId] = useState('');
  const [name, setName] = useState('Living room visualisation');
  const [busy, setBusy] = useState(false);
  const [renderingId, setRenderingId] = useState('');
  const [message, setMessage] = useState('');
  const [rendered, setRendered] = useState<Visualisation | null>(null);
  const filteredMoodboards = useMemo(() => moodboards.filter(m => !spaceId || !m.project_space_id || m.project_space_id === spaceId), [moodboards, spaceId]);
  const filteredConcepts = useMemo(() => concepts.filter(c => !spaceId || !c.project_space_id || c.project_space_id === spaceId), [concepts, spaceId]);
  const sourceAssets = useMemo(() => assets.filter(a => a.kind === 'site_photo' && (!spaceId || !a.space_id || a.space_id === spaceId)), [assets, spaceId]);
  const selectedBoard = moodboards.find(m => m.id === moodboardId);

  async function createBrief() {
    setBusy(true); setMessage('');
    try { await createVisualisationBrief({ projectSlug, name, spaceId: spaceId || null, moodboardId: moodboardId || null, designConceptId: conceptId || null, sourceAssetId: sourceAssetId || null }); setMessage('Visualisation brief created.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create brief'); }
    finally { setBusy(false); }
  }

  async function render(id: string) {
    setRenderingId(id); setMessage('Generating photorealistic visualisation…');
    try { await renderVisualisation({ visualisationId: id }); setRendered(visualisations.find(v => v.id === id) || null); setMessage('Render completed and saved to project assets. Refresh to view it.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not render visualisation'); }
    finally { setRenderingId(''); }
  }

  return <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
    <aside className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Render preparation</p>
      <h2 className="mt-2 text-xl font-semibold text-stone-900">Build the brief</h2>
      <p className="mt-1 text-sm text-stone-500">Use a room photo when available. The renderer will preserve the architecture while applying the selected design direction.</p>
      <div className="mt-6 space-y-4">
        <label className="block text-xs font-medium text-stone-500">Visualisation name<input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium text-stone-500">Space<select value={spaceId} onChange={e=>{setSpaceId(e.target.value);setMoodboardId('');setConceptId('');setSourceAssetId('')}} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"><option value="">Whole project</option>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block text-xs font-medium text-stone-500">Moodboard<select value={moodboardId} onChange={e=>setMoodboardId(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"><option value="">No moodboard</option>{filteredMoodboards.map(m=><option key={m.id} value={m.id}>{m.name} · {m.style_direction}</option>)}</select></label>
        <label className="block text-xs font-medium text-stone-500">Spatial concept<select value={conceptId} onChange={e=>setConceptId(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"><option value="">No concept</option>{filteredConcepts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="block text-xs font-medium text-stone-500">Existing room photo<select value={sourceAssetId} onChange={e=>setSourceAssetId(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"><option value="">None — generate from brief</option>{sourceAssets.map(a=><option key={a.id} value={a.id}>{a.alt_text || 'Site photo'}</option>)}</select></label>
        <button onClick={createBrief} disabled={busy || !name.trim()} className="w-full rounded-full bg-stone-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Creating…' : 'Create visualisation brief'}</button>
        {message && <p className="text-xs font-medium text-stone-600">{message}</p>}
      </div>
    </aside>
    <div className="space-y-6">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Selected direction</p><h3 className="mt-1 text-2xl font-semibold text-stone-900">{selectedBoard?.name || 'No moodboard selected'}</h3></div>{selectedBoard?.style_direction && <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">{selectedBoard.style_direction}</span>}</div>
        <div className="mt-5 flex gap-2">{(selectedBoard?.palette || []).map((colour, i)=><span key={`${colour}-${i}`} title={colour} className="h-12 w-12 rounded-full border border-white shadow" style={{background: colour}} />)}</div>
        <div className="mt-5 rounded-2xl bg-stone-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Pipeline</p><div className="mt-3 grid gap-2 sm:grid-cols-5">{['Source photo','Moodboard','Spatial concept','AI visualisation','Client presentation'].map((step,i)=><div key={step} className="rounded-xl border border-stone-200 bg-white p-3"><span className="text-[10px] text-stone-400">0{i+1}</span><p className="mt-1 text-xs font-medium text-stone-700">{step}</p></div>)}</div></div>
      </div>
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-stone-900">Visualisation jobs</h3><span className="text-xs text-stone-400">{visualisations.length} briefs</span></div><div className="mt-4 space-y-2">{visualisations.length ? visualisations.map(v=><div key={v.id} className="flex items-center justify-between gap-4 rounded-2xl border border-stone-100 bg-stone-50 p-4"><div><p className="text-sm font-medium text-stone-800">{v.name}</p><p className="mt-1 text-xs text-stone-400">{new Date(v.created_at).toLocaleString()}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-stone-600">{v.status}</span>{(v.status === 'brief' || v.status === 'failed') && <button onClick={()=>render(v.id)} disabled={!!renderingId} className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">{renderingId === v.id ? 'Rendering…' : 'Render'}</button>}</div></div>) : <p className="py-8 text-center text-sm text-stone-400">No visualisation briefs yet.</p>}</div></div>
    </div>
  </section>;
}
