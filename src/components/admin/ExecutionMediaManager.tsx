'use client';

import { useState } from 'react';
import { deleteProjectAsset, uploadProjectAsset } from '@/app/admin-dashboard/actions';

type Space = { id: string; name: string };
type Asset = {
  id: string;
  space_id: string | null;
  kind: string;
  storage_path: string;
  alt_text: string | null;
  created_at: string;
  signed_url?: string | null;
};

export function ExecutionMediaManager({
  projectId,
  spaces,
  initialAssets,
}: {
  projectId: string;
  spaces: Space[];
  initialAssets: Asset[];
}) {
  const [assets, setAssets] = useState(initialAssets);
  const [spaceId, setSpaceId] = useState('');
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMessage('Uploading…');
    try {
      const asset = await uploadProjectAsset({
        projectId,
        spaceId: spaceId || null,
        kind: 'progress',
        altText: caption,
        file,
      });
      setAssets((current) => [asset, ...current]);
      setCaption('');
      setFile(null);
      const input = document.getElementById('execution-progress-file') as HTMLInputElement | null;
      if (input) input.value = '';
      setMessage('Progress photo added');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not upload progress photo.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(asset: Asset) {
    if (!window.confirm('Delete this progress photo?')) return;
    setBusy(true);
    try {
      await deleteProjectAsset({ projectId, assetId: asset.id });
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setMessage('Progress photo deleted');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not delete progress photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-3xl border border-stone-200 bg-white">
      <div className="border-b border-stone-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Site photos</h2>
            <p className="mt-1 text-xs text-stone-500">Add dated visual evidence for the client progress gallery.</p>
          </div>
          {message && <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">{message}</span>}
        </div>
      </div>

      <div className="p-6">
        <div className="grid gap-3">
          <select value={spaceId} onChange={(event) => setSpaceId(event.target.value)} className="rounded-xl border border-stone-300 px-3 py-2 text-sm">
            <option value="">General project</option>
            {spaces.map((space) => <option key={space.id} value={space.id}>{space.name}</option>)}
          </select>
          <input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Caption, e.g. Kitchen cabinetry installation" className="rounded-xl border border-stone-300 px-3 py-2 text-sm" />
          <input id="execution-progress-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="rounded-xl border border-dashed border-stone-300 p-3 text-sm" />
          <button type="button" disabled={busy || !file} onClick={upload} className="rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? 'Working…' : 'Add progress photo'}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {assets.slice(0, 8).map((asset) => (
            <div key={asset.id} className="overflow-hidden rounded-xl border border-stone-200">
              <div className="aspect-[4/3] bg-stone-100">
                {asset.signed_url ? <img src={asset.signed_url} alt={asset.alt_text || 'Project progress'} className="h-full w-full object-cover" /> : null}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-xs font-medium text-stone-800">{asset.alt_text || 'Site progress'}</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-stone-400">{new Date(asset.created_at).toLocaleDateString()}</span>
                  <button type="button" onClick={() => remove(asset)} disabled={busy} className="text-[10px] font-medium text-red-600">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!assets.length && <p className="mt-4 text-sm text-stone-500">No site progress photos yet.</p>}
      </div>
    </section>
  );
}
