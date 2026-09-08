'use client';

import { useMemo, useState } from 'react';
import { saveMoodboard } from '@/app/admin-dashboard/actions';

type Space = { id: string; name: string; space_type?: string | null };
type Asset = { id: string; space_id?: string | null; kind: string; alt_text?: string | null; signed_url?: string | null };
type Item = { id: string; assetId?: string | null; title: string; category: string; notes?: string; sortOrder: number };

const directions = ['Modern', 'Warm Contemporary', 'Luxury', 'African Modern', 'Japandi', 'Minimal'];
const starterPalette = ['#F2EEE7', '#D8C8B5', '#A58C72', '#4A463F', '#F7F4EF'];

export default function MoodboardStudio({ projectSlug, spaces, assets, initialBoard }: { projectSlug: string; spaces: Space[]; assets: Asset[]; initialBoard?: any | null }) {
  const [name, setName] = useState(initialBoard?.name ?? 'New Moodboard');
  const [spaceId, setSpaceId] = useState(initialBoard?.project_space_id ?? spaces[0]?.id ?? '');
  const [direction, setDirection] = useState(initialBoard?.style_direction ?? 'Modern');
  const [description, setDescription] = useState(initialBoard?.description ?? '');
  const [notes, setNotes] = useState(initialBoard?.notes ?? '');
  const [palette, setPalette] = useState<string[]>(initialBoard?.palette ?? starterPalette);
  const [items, setItems] = useState<Item[]>(initialBoard?.items ?? []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const availableAssets = useMemo(() => assets.filter(a => !spaceId || !a.space_id || a.space_id === spaceId), [assets, spaceId]);
  const addAsset = (asset: Asset) => {
    if (items.some(i => i.assetId === asset.id)) return;
    setItems(prev => [...prev, { id: crypto.randomUUID(), assetId: asset.id, title: asset.alt_text || `${asset.kind.replace('_', ' ')} reference`, category: asset.kind.replace('_', ' '), sortOrder: prev.length }]);
  };
  const addCard = () => setItems(prev => [...prev, { id: crypto.randomUUID(), title: 'Material / idea', category: 'material', notes: 'Add a note about texture, finish or use.', sortOrder: prev.length }]);
  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const save = async () => {
    setBusy(true); setMessage('');
    try { await saveMoodboard({ projectSlug, moodboardId: initialBoard?.id ?? null, name, spaceId: spaceId || null, styleDirection: direction, description, notes, palette, items }); setMessage('Moodboard saved'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save moodboard'); }
    finally { setBusy(false); }
  };

  return <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Visual direction</p><h2 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">Moodboard Studio</h2><p className="mt-1 max-w-2xl text-sm text-stone-500">Curate the look and feel before moving from concept into visualisation.</p></div>
      <button onClick={save} disabled={busy} className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save moodboard'}</button>
    </div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4 rounded-2xl bg-stone-50 p-4">
        <label className="block text-xs font-medium text-stone-500">Name<input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" /></label>
        <label className="block text-xs font-medium text-stone-500">Space<select value={spaceId} onChange={e=>setSpaceId(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm"><option value="">Whole project</option>{spaces.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <label className="block text-xs font-medium text-stone-500">Direction<select value={direction} onChange={e=>setDirection(e.target.value)} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm">{directions.map(d=><option key={d}>{d}</option>)}</select></label>
        <label className="block text-xs font-medium text-stone-500">Description<textarea value={description} onChange={e=>setDescription(e.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" placeholder="What should this room feel like?" /></label>
        <div><p className="text-xs font-medium text-stone-500">Palette</p><div className="mt-2 flex flex-wrap gap-2">{palette.map((c,i)=><label key={`${c}-${i}`} className="relative h-9 w-9 overflow-hidden rounded-full border border-white shadow"><input type="color" value={c} onChange={e=>setPalette(p=>p.map((x,j)=>j===i?e.target.value:x))} className="absolute inset-0 h-full w-full cursor-pointer opacity-0"/><span className="block h-full w-full" style={{background:c}} /></label>)}<button onClick={()=>palette.length<12&&setPalette(p=>[...p,'#B8B0A5'])} className="h-9 w-9 rounded-full border border-dashed border-stone-300 text-stone-500">+</button></div></div>
        <label className="block text-xs font-medium text-stone-500">Designer notes<textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} className="mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm" placeholder="Materials, lighting, joinery, mood…" /></label>
        {message && <p className="text-xs font-medium text-stone-600">{message}</p>}
      </aside>
      <div>
        <div className="grid auto-rows-[150px] grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((item, index) => { const asset = assets.find(a=>a.id===item.assetId); return <article key={item.id} className={`group relative overflow-hidden rounded-2xl border border-stone-200 bg-stone-100 ${index===0?'md:col-span-2 md:row-span-2':''}`}>{asset?.signed_url ? <img src={asset.signed_url} alt={item.title} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col justify-end p-4"><span className="text-[10px] font-semibold uppercase tracking-widest text-stone-400">{item.category}</span><p className="mt-1 text-sm font-medium text-stone-800">{item.title}</p><p className="mt-1 text-xs text-stone-500">{item.notes}</p></div>}<button onClick={()=>remove(item.id)} className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs text-stone-600 opacity-0 shadow group-hover:opacity-100">Remove</button></article> })}
          <button onClick={addCard} className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-4 text-left text-sm text-stone-500 hover:bg-stone-100">+ Add material / idea</button>
        </div>
        <div className="mt-5 border-t border-stone-100 pt-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Project references</p><div className="mt-3 flex gap-3 overflow-x-auto pb-2">{availableAssets.map(asset=><button key={asset.id} onClick={()=>addAsset(asset)} className="w-28 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-white text-left"><div className="h-20 bg-stone-100">{asset.signed_url&&<img src={asset.signed_url} alt="" className="h-full w-full object-cover"/>}</div><div className="p-2"><p className="truncate text-[11px] font-medium text-stone-700">{asset.alt_text || asset.kind.replace('_',' ')}</p><p className="mt-1 text-[10px] text-stone-400">Add</p></div></button>)}</div></div>
      </div>
    </div>
  </section>;
}
