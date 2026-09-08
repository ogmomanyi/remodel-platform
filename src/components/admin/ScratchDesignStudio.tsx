'use client';

import { useMemo, useState } from 'react';
import { saveScratchDesign } from '@/app/admin-dashboard/actions';

type DesignElement = {
  id: string;
  type: 'room' | 'wall' | 'window' | 'door' | 'sofa' | 'table' | 'plant' | 'text';
  x: number; y: number; width: number; height: number; rotation: number; label?: string;
};

type SavedDesign = { id: string; name: string; elements: DesignElement[]; version: number; updated_at: string };

const PALETTE: Array<{ type: DesignElement['type']; label: string; width: number; height: number }> = [
  { type: 'room', label: 'Room', width: 360, height: 220 }, { type: 'wall', label: 'Wall', width: 160, height: 14 },
  { type: 'window', label: 'Window', width: 110, height: 10 }, { type: 'door', label: 'Door', width: 80, height: 12 },
  { type: 'sofa', label: 'Sofa', width: 130, height: 58 }, { type: 'table', label: 'Table', width: 82, height: 82 },
  { type: 'plant', label: 'Plant', width: 46, height: 46 }, { type: 'text', label: 'Label', width: 120, height: 30 },
];

function createId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function ScratchDesignStudio({ projectSlug, initialDesigns = [] }: { projectSlug: string; initialDesigns?: SavedDesign[] }) {
  const [elements, setElements] = useState<DesignElement[]>(initialDesigns[0]?.elements ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [designId, setDesignId] = useState<string | null>(initialDesigns[0]?.id ?? null);
  const [designName, setDesignName] = useState(initialDesigns[0]?.name ?? 'Concept 01');
  const [designs, setDesigns] = useState(initialDesigns);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const selected = useMemo(() => elements.find((item) => item.id === selectedId) ?? null, [elements, selectedId]);

  function add(type: DesignElement['type']) {
    const preset = PALETTE.find((item) => item.type === type)!;
    const item: DesignElement = { id: createId(), type, x: 120 + (elements.length % 4) * 90, y: 90 + (elements.length % 3) * 75, width: preset.width, height: preset.height, rotation: 0, label: preset.label };
    setElements((current) => [...current, item]); setSelectedId(item.id); setMessage('Unsaved changes');
  }
  function updateSelected(patch: Partial<DesignElement>) { if (!selectedId) return; setElements((current) => current.map((item) => item.id === selectedId ? { ...item, ...patch } : item)); setMessage('Unsaved changes'); }
  function moveSelected(dx: number, dy: number) { updateSelected({ x: (selected?.x ?? 0) + dx, y: (selected?.y ?? 0) + dy }); }
  function rotateSelected(degrees: number) { updateSelected({ rotation: (selected?.rotation ?? 0) + degrees }); }
  function removeSelected() { if (!selectedId) return; setElements((current) => current.filter((item) => item.id !== selectedId)); setSelectedId(null); setMessage('Unsaved changes'); }
  function newDesign() { setDesignId(null); setDesignName(`Concept ${String(designs.length + 1).padStart(2, '0')}`); setElements([]); setSelectedId(null); setMessage('New unsaved concept'); }
  function loadDesign(design: SavedDesign) { setDesignId(design.id); setDesignName(design.name); setElements(design.elements); setSelectedId(null); setMessage(''); }
  async function save() {
    setSaving(true); setMessage('Saving…');
    try {
      const saved = await saveScratchDesign({ projectSlug, designId, name: designName, elements });
      setDesignId(saved.id); setDesignName(saved.name);
      setDesigns((current) => [{ ...saved, elements, version: saved.version }, ...current.filter((item) => item.id !== saved.id)]);
      setMessage(`Saved · v${saved.version}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save the design.'); }
    finally { setSaving(false); }
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 px-5 py-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div><h2 className="text-lg font-semibold text-gray-900">Create from scratch</h2><p className="text-sm text-gray-500 mt-1">Build an editable room or makeover concept without an image-generation dependency.</p></div>
          <div className="flex items-center gap-2"><button type="button" onClick={newDesign} className="px-3 py-1.5 rounded border text-sm">New concept</button><button type="button" disabled={saving} onClick={save} className="px-4 py-1.5 rounded bg-slate-900 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save design'}</button><button type="button" onClick={() => setZoom((v) => Math.max(.6, v - .1))} className="px-3 py-1.5 rounded border">−</button><span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((v) => Math.min(1.8, v + .1))} className="px-3 py-1.5 rounded border">+</button></div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3"><input value={designName} onChange={(event) => { setDesignName(event.target.value); setMessage('Unsaved changes'); }} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Design name" />{message && <span className="text-xs text-slate-500 self-center">{message}</span>}</div>
        {designs.length > 0 && <div className="flex flex-wrap gap-2">{designs.map((design) => <button key={design.id} type="button" onClick={() => loadDesign(design)} className={`px-3 py-1 rounded-full text-xs border ${design.id === designId ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}>{design.name}</button>)}</div>}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[180px_minmax(0,1fr)_230px]">
        <aside className="border-b xl:border-b-0 xl:border-r border-gray-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Elements</p><div className="grid grid-cols-2 xl:grid-cols-1 gap-2">{PALETTE.map((item) => <button key={item.type} type="button" onClick={() => add(item.type)} className="text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 text-sm">+ {item.label}</button>)}</div><button type="button" onClick={() => { setElements([]); setSelectedId(null); setMessage('Unsaved changes'); }} className="mt-4 text-xs text-red-600">Clear canvas</button></aside>
        <div className="bg-slate-100 p-4 md:p-6 min-h-[560px] overflow-auto"><div className="relative mx-auto bg-white shadow-sm border border-slate-300" style={{ width: 760 * zoom, height: 520 * zoom }}><svg width={760 * zoom} height={520 * zoom} viewBox="0 0 760 520" className="block" onClick={() => setSelectedId(null)}><defs><pattern id="design-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1" /></pattern></defs><rect width="760" height="520" fill="url(#design-grid)" /><text x="24" y="30" fontSize="12" fill="#94a3b8">KOTA DESIGN STUDIO · CONCEPT CANVAS</text>{elements.map((item) => { const active = item.id === selectedId; const fill = item.type === 'room' ? '#f8fafc' : item.type === 'wall' ? '#334155' : item.type === 'window' ? '#bfdbfe' : item.type === 'door' ? '#c4b5fd' : item.type === 'sofa' ? '#d6d3d1' : item.type === 'table' ? '#fde68a' : item.type === 'plant' ? '#bbf7d0' : 'transparent'; return <g key={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation} ${item.width / 2} ${item.height / 2})`} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }} style={{ cursor: 'pointer' }}><rect width={item.width} height={item.height} rx={item.type === 'room' ? 2 : 8} fill={fill} stroke={active ? '#111827' : '#64748b'} strokeWidth={active ? 3 : 1.5} />{item.type === 'window' && <line x1="8" y1={item.height / 2} x2={item.width - 8} y2={item.height / 2} stroke="#2563eb" strokeWidth="3" />}{item.type === 'door' && <path d={`M 6 ${item.height} A ${item.width - 12} ${item.width - 12} 0 0 1 ${item.width - 6} ${item.height}`} fill="none" stroke="#6d28d9" />}{item.type === 'plant' && <circle cx={item.width / 2} cy={item.height / 2 - 5} r={10} fill="#16a34a" />}{item.label && item.type !== 'plant' && <text x={item.width / 2} y={item.height / 2 + 4} textAnchor="middle" fontSize={item.type === 'room' ? 16 : 11} fill="#334155">{item.label}</text>}</g>; })}</svg></div></div>
        <aside className="border-t xl:border-t-0 xl:border-l border-gray-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Properties</p>{!selected ? <p className="text-sm text-gray-500">Select an element to edit it.</p> : <div className="space-y-4"><div><p className="text-sm font-medium">{selected.label || selected.type}</p><p className="text-xs text-gray-500">{selected.type}</p></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => moveSelected(-10, 0)} className="px-2 py-2 rounded border">←</button><button type="button" onClick={() => moveSelected(10, 0)} className="px-2 py-2 rounded border">→</button><button type="button" onClick={() => moveSelected(0, -10)} className="px-2 py-2 rounded border">↑</button><button type="button" onClick={() => moveSelected(0, 10)} className="px-2 py-2 rounded border">↓</button></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => rotateSelected(-15)} className="px-2 py-2 rounded border text-xs">↺ 15°</button><button type="button" onClick={() => rotateSelected(15)} className="px-2 py-2 rounded border text-xs">↻ 15°</button></div><label className="block text-sm">Label<input value={selected.label || ''} onChange={(event) => updateSelected({ label: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label><div className="grid grid-cols-2 gap-2"><label className="block text-sm">Width<input type="number" value={selected.width} onChange={(event) => updateSelected({ width: Number(event.target.value) || 1 })} className="mt-1 w-full rounded border border-gray-300 px-2 py-2" /></label><label className="block text-sm">Height<input type="number" value={selected.height} onChange={(event) => updateSelected({ height: Number(event.target.value) || 1 })} className="mt-1 w-full rounded border border-gray-300 px-2 py-2" /></label></div><button type="button" onClick={removeSelected} className="w-full px-3 py-2 rounded border border-red-200 text-red-600">Delete</button></div>}</aside>
      </div>
      <div className="border-t border-gray-200 px-5 py-4 bg-slate-50 text-xs text-slate-500">Saved concepts are stored against the project and recorded in the project activity log.</div>
    </section>
  );
}
