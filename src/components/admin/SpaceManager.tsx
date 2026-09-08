'use client';

import { useState } from 'react';
import { createSpace, createDesignOption, deleteSpace, deleteDesignOption } from '@/app/admin-dashboard/actions';

type Option = { id: string; name: string; description: string | null; cost_estimate: number | null; currency: string; status: string; is_recommended: boolean };
type Space = { id: string; name: string; space_type: string; existing_notes: string | null; options: Option[] };

export function SpaceManager({ projectId, initialSpaces }: { projectId: string; initialSpaces: Space[] }) {
  const [spaces, setSpaces] = useState(initialSpaces);
  const [spaceName, setSpaceName] = useState('');
  const [spaceType, setSpaceType] = useState('living_room');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function addSpace() {
    if (!spaceName.trim()) return;
    setBusy(true); setMessage('Saving…');
    try {
      const space = await createSpace({ projectId, name: spaceName, spaceType });
      setSpaces((current) => [...current, { ...space, options: [] }]);
      setSpaceName(''); setMessage('Space added');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not add space.'); }
    finally { setBusy(false); }
  }

  async function removeSpace(id: string) {
    if (!window.confirm('Delete this space and its design options?')) return;
    setBusy(true);
    try { await deleteSpace({ projectId, spaceId: id }); setSpaces((current) => current.filter((space) => space.id !== id)); setMessage('Space deleted'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete space.'); }
    finally { setBusy(false); }
  }

  async function addOption(spaceId: string, name: string, description: string, cost: string, recommended: boolean) {
    if (!name.trim()) return;
    setBusy(true); setMessage('Saving…');
    try {
      const option = await createDesignOption({ spaceId, name, description, costEstimate: cost ? Number(cost) : null, isRecommended: recommended });
      setSpaces((current) => current.map((space) => space.id === spaceId ? { ...space, options: [...space.options, option] } : space));
      setMessage('Design option added');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not add option.'); }
    finally { setBusy(false); }
  }

  async function removeOption(spaceId: string, optionId: string) {
    if (!window.confirm('Delete this design option?')) return;
    setBusy(true);
    try { await deleteDesignOption({ spaceId, optionId }); setSpaces((current) => current.map((space) => space.id === spaceId ? { ...space, options: space.options.filter((option) => option.id !== optionId) } : space)); setMessage('Option deleted'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Could not delete option.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
        <div><h2 className="text-lg font-semibold text-gray-900">Spaces & design options</h2><p className="text-sm text-gray-500 mt-1">Build the renovation area by area, then add alternative design directions for each space.</p></div>
        {message && <span className="text-xs rounded-full bg-slate-100 px-3 py-1 text-slate-600">{message}</span>}
      </div>
      <div className="grid md:grid-cols-[1.5fr_1fr_auto] gap-2 mb-6">
        <input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} placeholder="e.g. Veranda" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        <select value={spaceType} onChange={(event) => setSpaceType(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="living_room">Living room</option><option value="dining">Dining</option><option value="kitchen">Kitchen</option><option value="bedroom">Bedroom</option><option value="bathroom">Bathroom</option><option value="veranda">Veranda</option><option value="patio">Patio</option><option value="outdoor">Outdoor</option><option value="other">Other</option>
        </select>
        <button type="button" disabled={busy} onClick={addSpace} className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">+ Add space</button>
      </div>
      {spaces.length === 0 ? <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No spaces yet. Add Veranda, Living Room, Kitchen, Patio, Bedroom, or any other area.</div> : <div className="space-y-4">
        {spaces.map((space) => <SpaceCard key={space.id} space={space} busy={busy} onDelete={() => removeSpace(space.id)} onAddOption={addOption} onDeleteOption={removeOption} />)}
      </div>}
    </section>
  );
}

function SpaceCard({ space, busy, onDelete, onAddOption, onDeleteOption }: { space: Space; busy: boolean; onDelete: () => void; onAddOption: (spaceId: string, name: string, description: string, cost: string, recommended: boolean) => void; onDeleteOption: (spaceId: string, optionId: string) => void }) {
  const [name, setName] = useState(''); const [description, setDescription] = useState(''); const [cost, setCost] = useState(''); const [recommended, setRecommended] = useState(false);
  return <div className="rounded-xl border border-gray-200 p-5 bg-slate-50/60">
    <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-gray-900">{space.name}</h3><p className="text-xs uppercase tracking-wide text-slate-500 mt-1">{space.space_type.replaceAll('_', ' ')}</p>{space.existing_notes && <p className="text-sm text-slate-600 mt-2">{space.existing_notes}</p>}</div><button type="button" onClick={onDelete} className="text-xs text-red-600 hover:text-red-800">Delete</button></div>
    <div className="mt-4 space-y-2">{space.options.length ? space.options.map((option) => <div key={option.id} className="bg-white rounded-lg border border-gray-200 p-3 flex items-start justify-between gap-3"><div><div className="flex flex-wrap gap-2 items-center"><h4 className="font-medium text-sm text-gray-900">{option.name}</h4>{option.is_recommended && <span className="text-[10px] rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 font-semibold">RECOMMENDED</span>}</div>{option.description && <p className="text-xs text-gray-500 mt-1">{option.description}</p>}{option.cost_estimate !== null && <p className="text-xs text-slate-700 mt-2">{option.currency} {Number(option.cost_estimate).toLocaleString()}</p>}</div><button type="button" onClick={() => onDeleteOption(space.id, option.id)} className="text-xs text-red-600">Delete</button></div>) : <p className="text-xs text-gray-500">No design options yet.</p>}</div>
    <div className="mt-4 grid md:grid-cols-[1.2fr_1.5fr_120px_auto] gap-2 items-end"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Option name" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description / direction" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /><input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="Cost (KES)" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" /><button type="button" disabled={busy || !name.trim()} onClick={() => { onAddOption(space.id, name, description, cost, recommended); setName(''); setDescription(''); setCost(''); setRecommended(false); }} className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm disabled:opacity-50">+ Option</button></div>
    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={recommended} onChange={(e) => setRecommended(e.target.checked)} /> Mark recommended</label>
  </div>;
}
