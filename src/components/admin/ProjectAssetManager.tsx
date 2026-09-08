'use client';

import { useState } from 'react';
import { deleteProjectAsset, uploadProjectAsset } from '@/app/admin-dashboard/actions';

type Asset = {
  id: string;
  space_id: string | null;
  kind: string;
  storage_path: string;
  alt_text: string | null;
  created_at: string;
  signed_url?: string | null;
};

type Space = { id: string; name: string };

const kinds = [
  ['site_photo', 'Existing photo'],
  ['plan', 'Floor plan'],
  ['material', 'Material / finish'],
  ['document', 'Reference document'],
] as const;

export function ProjectAssetManager({ projectId, spaces, initialAssets }: { projectId: string; spaces: Space[]; initialAssets: Asset[] }) {
  const [assets, setAssets] = useState(initialAssets);
  const [kind, setKind] = useState<string>('site_photo');
  const [spaceId, setSpaceId] = useState(spaces[0]?.id ?? '');
  const [altText, setAltText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function upload() {
    if (!file) return;
    setBusy(true); setMessage('Uploading…');
    try {
      const result = await uploadProjectAsset({ projectId, spaceId: spaceId || null, kind, altText, file });
      setAssets((current) => [result, ...current]);
      setFile(null); setAltText(''); setMessage('Asset uploaded');
      const input = document.getElementById('project-asset-file') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not upload asset.'); }
    finally { setBusy(false); }
  }

  async function remove(asset: Asset) {
    if (!window.confirm('Delete this project asset?')) return;
    setBusy(true);
    try { await deleteProjectAsset({ projectId, assetId: asset.id }); setAssets((current) => current.filter((item) => item.id !== asset.id)); setMessage('Asset deleted'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete asset.'); }
    finally { setBusy(false); }
  }

  return <section className="bg-white rounded-xl border border-gray-200 p-6">
    <div className="flex items-start justify-between gap-4 mb-5"><div><h2 className="text-lg font-semibold text-gray-900">Project visuals</h2><p className="text-sm text-slate-500 mt-1">Upload the real room, plans and materials that will feed the moodboard and visualisation workflow.</p></div>{message && <span className="text-xs rounded-full bg-slate-100 px-3 py-1 text-slate-600">{message}</span>}</div>
    <div className="grid md:grid-cols-2 gap-3">
      <label className="text-xs font-medium text-slate-500 uppercase">Asset type<select value={kind} onChange={(e) => setKind(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm normal-case">{kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-xs font-medium text-slate-500 uppercase">Space<select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm normal-case"><option value="">Project-level</option>{spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}</select></label>
      <label className="md:col-span-2 text-xs font-medium text-slate-500 uppercase">Description / caption<input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="e.g. Existing veranda facing garden" className="mt-1 w-full rounded-lg border px-3 py-2 text-sm normal-case" /></label>
      <label className="md:col-span-2 block rounded-lg border border-dashed border-slate-300 p-4 cursor-pointer hover:bg-slate-50"><span className="text-sm font-medium text-slate-800">Choose a photo, plan or reference</span><input id="project-asset-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" /><span className="text-xs text-slate-500 block mt-1">Images and PDF. Maximum 10 MB per upload.</span></label>
      <button type="button" disabled={busy || !file} onClick={upload} className="md:col-span-2 rounded-lg bg-slate-900 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-50">{busy ? 'Working…' : 'Upload visual asset'}</button>
    </div>
    <div className="mt-6 space-y-2">{assets.length ? assets.map((asset) => <div key={asset.id} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"><div className="w-16 h-16 rounded-md bg-slate-100 overflow-hidden shrink-0">{asset.signed_url && asset.kind !== 'document' ? <img src={asset.signed_url} alt={asset.alt_text || asset.kind} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] uppercase text-slate-500">{asset.kind.replace('_', ' ')}</div>}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium text-gray-900">{asset.alt_text || asset.kind.replaceAll('_', ' ')}</p><p className="text-xs text-slate-500 mt-1">{asset.space_id ? spaces.find((space) => space.id === asset.space_id)?.name || 'Space' : 'Project-level'} · {new Date(asset.created_at).toLocaleDateString()}</p></div><button type="button" disabled={busy} onClick={() => remove(asset)} className="text-xs text-red-600">Delete</button></div>) : <p className="text-sm text-slate-500">No visual assets uploaded yet.</p>}</div>
  </section>;
}
