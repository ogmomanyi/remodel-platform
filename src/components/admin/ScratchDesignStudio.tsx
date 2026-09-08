'use client';

import { useMemo, useState } from 'react';
import { saveScratchDesign } from '@/app/admin-dashboard/actions';

type Style = 'modern' | 'warm' | 'luxury' | 'african-modern' | 'japandi' | 'minimal';
type Mood = 'bright' | 'earthy' | 'calm' | 'dramatic' | 'natural';
type Finish = 'practical' | 'premium' | 'luxury';

type DesignElement = {
  id: string;
  type: 'room' | 'wall' | 'window' | 'door' | 'sofa' | 'table' | 'plant' | 'text';
  x: number; y: number; width: number; height: number; rotation: number; label?: string;
  finish?: string; accent?: string; material?: string;
};

type SavedDesign = { id: string; name: string; elements: DesignElement[]; version: number; updated_at: string };

const PALETTE: Array<{ type: DesignElement['type']; label: string; width: number; height: number }> = [
  { type: 'room', label: 'Room', width: 360, height: 220 }, { type: 'wall', label: 'Wall', width: 160, height: 14 },
  { type: 'window', label: 'Window', width: 110, height: 10 }, { type: 'door', label: 'Door', width: 80, height: 12 },
  { type: 'sofa', label: 'Sofa', width: 130, height: 58 }, { type: 'table', label: 'Table', width: 82, height: 82 },
  { type: 'plant', label: 'Plant', width: 46, height: 46 }, { type: 'text', label: 'Label', width: 120, height: 30 },
];

const STYLE_PRESETS: Record<Style, { label: string; wall: string; sofa: string; wood: string; metal: string; accent: string; description: string }> = {
  modern: { label: 'Modern', wall: '#f1f5f9', sofa: '#cbd5e1', wood: '#b08968', metal: '#475569', accent: '#334155', description: 'Clean lines, restrained neutrals and contemporary finishes.' },
  warm: { label: 'Warm Contemporary', wall: '#f5efe6', sofa: '#c9a889', wood: '#8b5e3c', metal: '#57534e', accent: '#92400e', description: 'Soft neutrals, warm timber and welcoming textures.' },
  luxury: { label: 'Luxury', wall: '#f7f4ef', sofa: '#b8a58f', wood: '#6b4f3a', metal: '#9a835f', accent: '#7c5c35', description: 'Refined neutrals, richer materials and hotel-style detailing.' },
  'african-modern': { label: 'African Modern', wall: '#eee7dc', sofa: '#b89978', wood: '#704c35', metal: '#4d463f', accent: '#7f3f24', description: 'Contemporary forms grounded in earthy, natural textures.' },
  japandi: { label: 'Japandi', wall: '#f2f0e9', sofa: '#c7c0b4', wood: '#9b8064', metal: '#57534e', accent: '#575f45', description: 'Calm, tactile minimalism with soft wood and organic tones.' },
  minimal: { label: 'Minimal', wall: '#fafafa', sofa: '#d4d4d4', wood: '#a3a3a3', metal: '#525252', accent: '#404040', description: 'Quiet palette, simple forms and visual breathing room.' },
};

const MOOD_FILTERS: Record<Mood, string> = {
  bright: 'brightness(1.08) saturate(.92)', earthy: 'saturate(.9) sepia(.08)', calm: 'saturate(.82) brightness(1.02)', dramatic: 'contrast(1.08) saturate(1.05)', natural: 'saturate(.9) brightness(1.01)',
};

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
  const [style, setStyle] = useState<Style>('modern');
  const [mood, setMood] = useState<Mood>('natural');
  const [finish, setFinish] = useState<Finish>('premium');
  const selected = useMemo(() => elements.find((item) => item.id === selectedId) ?? null, [elements, selectedId]);
  const preset = STYLE_PRESETS[style];

  function add(type: DesignElement['type']) {
    const item = PALETTE.find((entry) => entry.type === type)!;
    const newItem: DesignElement = { id: createId(), type, x: 120 + (elements.length % 4) * 90, y: 90 + (elements.length % 3) * 75, width: item.width, height: item.height, rotation: 0, label: item.label };
    setElements((current) => [...current, newItem]); setSelectedId(newItem.id); setMessage('Unsaved changes');
  }
  function updateSelected(patch: Partial<DesignElement>) { if (!selectedId) return; setElements((current) => current.map((item) => item.id === selectedId ? { ...item, ...patch } : item)); setMessage('Unsaved changes'); }
  function moveSelected(dx: number, dy: number) { updateSelected({ x: (selected?.x ?? 0) + dx, y: (selected?.y ?? 0) + dy }); }
  function rotateSelected(degrees: number) { updateSelected({ rotation: (selected?.rotation ?? 0) + degrees }); }
  function removeSelected() { if (!selectedId) return; setElements((current) => current.filter((item) => item.id !== selectedId)); setSelectedId(null); setMessage('Unsaved changes'); }
  function newDesign() { setDesignId(null); setDesignName(`Concept ${String(designs.length + 1).padStart(2, '0')}`); setElements([]); setSelectedId(null); setMessage('New unsaved concept'); }
  function loadDesign(design: SavedDesign) { setDesignId(design.id); setDesignName(design.name); setElements(design.elements); setSelectedId(null); setMessage(''); }

  function beautify() {
    setElements((current) => current.map((item) => {
      if (item.type === 'room') return { ...item, finish: preset.wall, material: finish === 'luxury' ? 'limewash + feature wall' : finish === 'premium' ? 'premium paint' : 'washable paint', accent: preset.accent };
      if (item.type === 'sofa') return { ...item, finish: preset.sofa, material: finish === 'luxury' ? 'performance velvet' : finish === 'premium' ? 'textured fabric' : 'durable fabric', accent: preset.accent };
      if (item.type === 'table') return { ...item, finish: preset.wood, material: finish === 'luxury' ? 'natural oak / stone' : 'timber veneer', accent: preset.wood };
      if (item.type === 'wall') return { ...item, finish: preset.accent, material: style === 'african-modern' ? 'textured feature finish' : finish === 'luxury' ? 'decorative wall finish' : 'paint finish', accent: preset.accent };
      if (item.type === 'door') return { ...item, finish: preset.wood, material: finish === 'luxury' ? 'engineered timber' : 'timber finish', accent: preset.wood };
      if (item.type === 'window') return { ...item, finish: preset.metal, material: 'powder-coated frame', accent: preset.metal };
      if (item.type === 'plant') return { ...item, finish: preset.accent, material: style === 'african-modern' || mood === 'natural' ? 'indoor foliage' : 'statement planter', accent: preset.accent };
      return { ...item, finish: preset.accent, accent: preset.accent };
    }));
    setMessage(`Beautified · ${preset.label} · ${mood} · ${finish}`);
  }

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

  function fillFor(item: DesignElement) {
    if (item.finish) return item.finish;
    if (item.type === 'room') return '#f8fafc';
    if (item.type === 'wall') return '#334155';
    if (item.type === 'window') return '#bfdbfe';
    if (item.type === 'door') return '#c4b5fd';
    if (item.type === 'sofa') return '#d6d3d1';
    if (item.type === 'table') return '#fde68a';
    if (item.type === 'plant') return '#bbf7d0';
    return 'transparent';
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="border-b border-gray-200 px-5 py-4 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div><div className="text-xs uppercase tracking-wider text-slate-500">Design Studio</div><h2 className="text-lg font-semibold text-gray-900 mt-1">Create & beautify from scratch</h2><p className="text-sm text-gray-500 mt-1">Lay out the space first, then apply a coherent design direction without changing the underlying geometry.</p></div>
          <div className="flex items-center gap-2 flex-wrap"><button type="button" onClick={newDesign} className="px-3 py-1.5 rounded border text-sm">New concept</button><button type="button" disabled={saving} onClick={save} className="px-4 py-1.5 rounded bg-slate-900 text-white text-sm disabled:opacity-50">{saving ? 'Saving…' : 'Save design'}</button><button type="button" onClick={() => setZoom((v) => Math.max(.6, v - .1))} className="px-3 py-1.5 rounded border">−</button><span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((v) => Math.min(1.8, v + .1))} className="px-3 py-1.5 rounded border">+</button></div>
        </div>
        <div className="grid md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
          <label className="text-sm"><span className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Style</span><select value={style} onChange={(event) => setStyle(event.target.value as Style)} className="w-full rounded-lg border border-gray-300 px-3 py-2"><option value="modern">Modern</option><option value="warm">Warm Contemporary</option><option value="luxury">Luxury</option><option value="african-modern">African Modern</option><option value="japandi">Japandi</option><option value="minimal">Minimal</option></select></label>
          <label className="text-sm"><span className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Mood</span><select value={mood} onChange={(event) => setMood(event.target.value as Mood)} className="w-full rounded-lg border border-gray-300 px-3 py-2"><option value="bright">Bright</option><option value="earthy">Earthy</option><option value="calm">Calm</option><option value="dramatic">Dramatic</option><option value="natural">Natural</option></select></label>
          <label className="text-sm"><span className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Finish level</span><select value={finish} onChange={(event) => setFinish(event.target.value as Finish)} className="w-full rounded-lg border border-gray-300 px-3 py-2"><option value="practical">Practical</option><option value="premium">Premium</option><option value="luxury">Luxury</option></select></label>
          <button type="button" onClick={beautify} className="px-4 py-2 rounded-lg border border-slate-900 bg-white text-slate-900 font-medium text-sm">✦ Beautify</button>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3"><input value={designName} onChange={(event) => { setDesignName(event.target.value); setMessage('Unsaved changes'); }} className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Design name" /><span className="text-xs text-slate-500">{message || preset.description}</span></div>
        {designs.length > 0 && <div className="flex flex-wrap gap-2">{designs.map((design) => <button key={design.id} type="button" onClick={() => loadDesign(design)} className={`px-3 py-1 rounded-full text-xs border ${design.id === designId ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-300'}`}>{design.name}</button>)}</div>}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[180px_minmax(0,1fr)_230px]">
        <aside className="border-b xl:border-b-0 xl:border-r border-gray-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Elements</p><div className="grid grid-cols-2 xl:grid-cols-1 gap-2">{PALETTE.map((item) => <button key={item.type} type="button" onClick={() => add(item.type)} className="text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-400 hover:bg-gray-50 text-sm">+ {item.label}</button>)}</div><button type="button" onClick={() => { setElements([]); setSelectedId(null); setMessage('Unsaved changes'); }} className="mt-4 text-xs text-red-600">Clear canvas</button></aside>
        <div className="bg-slate-100 p-4 md:p-6 min-h-[560px] overflow-auto"><div className="relative mx-auto bg-white shadow-sm border border-slate-300" style={{ width: 760 * zoom, height: 520 * zoom }}><svg width={760 * zoom} height={520 * zoom} viewBox="0 0 760 520" className="block" style={{ filter: MOOD_FILTERS[mood] }} onClick={() => setSelectedId(null)}><defs><pattern id="design-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e5e7eb" strokeWidth="1" /></pattern></defs><rect width="760" height="520" fill="url(#design-grid)" /><text x="24" y="30" fontSize="12" fill="#94a3b8">KOTA DESIGN STUDIO · {preset.label.toUpperCase()}</text>{elements.map((item) => { const active = item.id === selectedId; return <g key={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation} ${item.width / 2} ${item.height / 2})`} onClick={(event) => { event.stopPropagation(); setSelectedId(item.id); }} style={{ cursor: 'pointer' }}><rect width={item.width} height={item.height} rx={item.type === 'room' ? 2 : 8} fill={fillFor(item)} stroke={active ? '#111827' : (item.accent || '#64748b')} strokeWidth={active ? 3 : 1.5} />{item.type === 'window' && <line x1="8" y1={item.height / 2} x2={item.width - 8} y2={item.height / 2} stroke={item.accent || '#2563eb'} strokeWidth="3" />}{item.type === 'door' && <path d={`M 6 ${item.height} A ${item.width - 12} ${item.width - 12} 0 0 1 ${item.width - 6} ${item.height}`} fill="none" stroke={item.accent || '#6d28d9'} />}{item.type === 'plant' && <circle cx={item.width / 2} cy={item.height / 2 - 5} r="10" fill={item.accent || '#16a34a'} />}{item.type === 'sofa' && <><rect x="7" y="7" width={Math.max(0, item.width - 14)} height="10" rx="5" fill={item.accent || preset.accent} opacity=".28" /><line x1="12" y1={item.height - 8} x2={item.width - 12} y2={item.height - 8} stroke={item.accent || preset.accent} strokeWidth="4" strokeLinecap="round" /></>}{item.type === 'table' && <circle cx={item.width / 2} cy={item.height / 2} r={Math.max(8, Math.min(item.width, item.height) / 2 - 8)} fill={item.finish || preset.wood} opacity=".88" />}{item.label && item.type !== 'plant' && <text x={item.width / 2} y={item.height / 2 + 4} textAnchor="middle" fontSize={item.type === 'room' ? 16 : 11} fill="#334155">{item.label}</text>}</g>; })}</svg></div></div>
        <aside className="border-t xl:border-t-0 xl:border-l border-gray-200 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3">Properties</p>{!selected ? <div className="space-y-4"><div className="rounded-lg bg-slate-50 p-3"><p className="font-medium text-sm">{preset.label}</p><p className="text-xs text-slate-500 mt-1">{preset.description}</p></div><div><p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Beautification recipe</p><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Wall</span><span className="text-slate-500">{finish === 'luxury' ? 'Decorative finish' : finish === 'premium' ? 'Premium paint' : 'Practical paint'}</span></div><div className="flex justify-between"><span>Furniture</span><span className="text-slate-500">{finish === 'luxury' ? 'Statement pieces' : finish === 'premium' ? 'Layered textures' : 'Durable pieces'}</span></div><div className="flex justify-between"><span>Palette</span><span className="text-slate-500">{mood}</span></div></div></div></div> : <div className="space-y-4"><div><p className="text-sm font-medium">{selected.label || selected.type}</p><p className="text-xs text-gray-500">{selected.type}</p>{selected.material && <p className="text-xs text-slate-500 mt-1">{selected.material}</p>}</div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => moveSelected(-10, 0)} className="px-2 py-2 rounded border">←</button><button type="button" onClick={() => moveSelected(10, 0)} className="px-2 py-2 rounded border">→</button><button type="button" onClick={() => moveSelected(0, -10)} className="px-2 py-2 rounded border">↑</button><button type="button" onClick={() => moveSelected(0, 10)} className="px-2 py-2 rounded border">↓</button></div><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => rotateSelected(-15)} className="px-2 py-2 rounded border text-xs">↺ 15°</button><button type="button" onClick={() => rotateSelected(15)} className="px-2 py-2 rounded border text-xs">↻ 15°</button></div><label className="block text-sm">Label<input value={selected.label || ''} onChange={(event) => updateSelected({ label: event.target.value })} className="mt-1 w-full rounded border border-gray-300 px-3 py-2" /></label><div className="grid grid-cols-2 gap-2"><label className="block text-sm">Width<input type="number" value={selected.width} onChange={(event) => updateSelected({ width: Number(event.target.value) || 1 })} className="mt-1 w-full rounded border border-gray-300 px-2 py-2" /></label><label className="block text-sm">Height<input type="number" value={selected.height} onChange={(event) => updateSelected({ height: Number(event.target.value) || 1 })} className="mt-1 w-full rounded border border-gray-300 px-2 py-2" /></label></div><button type="button" onClick={removeSelected} className="w-full px-3 py-2 rounded border border-red-200 text-red-600">Delete</button></div>}</aside>
      </div>
      <div className="border-t border-gray-200 px-5 py-4 bg-slate-50 text-xs text-slate-500">Beautify changes are part of the saved concept. The underlying layout remains editable, so designers can iterate before client presentation.</div>
    </section>
  );
}
