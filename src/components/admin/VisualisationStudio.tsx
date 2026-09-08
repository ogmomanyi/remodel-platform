'use client';

import { useState } from 'react';
import { createVisualisationBrief } from '@/app/admin-dashboard/actions';

type Space = { id: string; name: string };
type Board = { id: string; name: string; project_space_id?: string | null; style_direction?: string | null };
type Design = { id: string; name: string; space_id?: string | null };
type Asset = { id: string; kind: string; alt_text?: string | null; signed_url?: string | null; space_id?: string | null };

export default function VisualisationStudio({ projectSlug, spaces, moodboards, designs, assets, initialBrief }: { projectSlug: string; spaces: Space[]; moodboards: Board[]; designs: Design[]; assets: Asset[]; initialBrief?: { id: string; name: string; prompt: string; negative_prompt?: string | null; status: string } | null }) {
  const [name, setName] = useState(initialBrief?.name ?? 'Living Space Visualisation');
  const [spaceId, setSpaceId] = useState('');
  const [moodboardId, setMoodboardId] = useState('');
  const [designConceptId, setDesignConceptId] = useState('');
  const [sourceAssetId, setSourceAssetId] = useState('');
  const [result, setResult] = useState(initialBrief ?? null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const selectedMoodboard = moodboards.find(m => m.id === moodboardId);
  const relevantAssets = assets.filter(a => !spaceId || !a.space_id || a.space_id === spaceId);

  async function createBrief() {
    setBusy(true); setMessage('');
    try {
      const saved = await createVisualisationBrief({ projectSlug, name, spaceId: spaceId || null, moodboardId: moodboardId || null, designConceptId: designConceptId || null, sourceAssetId: sourceAssetId || null });
      setResult(saved); setMessage('Visualisation brief created');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not create visualisation brief'); }
    finally { setBusy(false); }
  }

  return <section className="rounded-3xl border border-stone-200 bg-stone-950 p-6 text-white shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Next stage</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Visualisation Studio</h2><p className="mt-1 max-w-2xl text-sm text-stone-400">Turn the approved visual direction into a production-ready brief for photorealistic rendering.</p></div>
      <span className="rounded-full border border-stone-700 px-3 py-1 text-xs text-stone-400">Brief → Render</span>
    </div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="space-y-4 rounded-2xl bg-stone-900 p-4">
        <label className="block text-xs text-stone-400">Visualisation name<input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-white" /></label>
        <label className="block text-xs text-stone-400">Space<select value={spaceId} onChange={e=>{setSpaceId(e.target.value);setMoodboardId('');setDesignConceptId('')}} className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-white"><option value="">Whole project</option>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block text-xs text-stone-400">Moodboard<select value={moodboardId} onChange={e=>setMoodboardId(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-white"><option value="">None</option>{moodboards.filter(m=>!spaceId || !m.project_space_id || m.project_space_id===spaceId).map(m=><option key={m.id} value={m.id}>{m.name}{m.style_direction ? ` · ${m.style_direction}` : ''}</option>)}</select></label>
        <label className="block text-xs text-stone-400">Spatial concept<select value={designConceptId} onChange={e=>setDesignConceptId(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-white"><option value="">None</option>{designs.filter(d=>!spaceId || !d.space_id || d.space_id===spaceId).map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label className="block text-xs text-stone-400">Source room photo<select value={sourceAssetId} onChange={e=>setSourceAssetId(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-700 bg-stone-950 px-3 py-2 text-sm text-white"><option value="">Use generated viewpoint</option>{relevantAssets.filter(a=>['site_photo','plan'].includes(a.kind) && a.signed_url).map(a=><option key={a.id} value={a.id}>{a.alt_text || a.kind.replace('_',' ')}</option>)}</select></label>
        <button onClick={createBrief} disabled={busy} className="w-full rounded-full bg-white px-5 py-2.5 text-sm font-medium text-stone-950 disabled:opacity-50">{busy?'Building brief…':'Build visualisation brief'}</button>
        {message && <p className="text-xs text-stone-400">{message}</p>}
      </div>
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-stone-800 p-4"><p className="text-xs text-stone-500">Direction</p><p className="mt-2 font-medium">{selectedMoodboard?.style_direction || 'Not selected'}</p></div><div className="rounded-2xl border border-stone-800 p-4"><p className="text-xs text-stone-500">References</p><p className="mt-2 font-medium">{sourceAssetId ? 'Room photo selected' : 'Conceptual viewpoint'}</p></div><div className="rounded-2xl border border-stone-800 p-4"><p className="text-xs text-stone-500">Status</p><p className="mt-2 font-medium capitalize">{result?.status || 'Not generated'}</p></div></div>
        {result ? <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5"><p className="text-xs font-semibold uppercase tracking-widest text-stone-500">Production prompt</p><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-6 text-stone-200">{result.prompt}</pre>{result.negative_prompt && <><p className="mt-5 text-xs font-semibold uppercase tracking-widest text-stone-500">Negative prompt</p><p className="mt-2 text-sm leading-6 text-stone-400">{result.negative_prompt}</p></>}</div> : <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-stone-800 text-center text-sm text-stone-500"><div><p className="text-lg text-stone-300">No visualisation brief yet</p><p className="mt-1">Choose a room, moodboard and optional source photo, then build the brief.</p></div></div>}
      </div>
    </div>
  </section>;
}
