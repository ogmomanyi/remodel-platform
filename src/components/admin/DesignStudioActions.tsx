'use client';

import { useState } from 'react';

export function DesignStudioActions({ projectSlug }: { projectSlug: string }) {
  const [copied, setCopied] = useState(false);
  const clientLink = typeof window !== 'undefined' ? `${window.location.origin}/${projectSlug}` : `/${projectSlug}`;

  async function copyLink() {
    await navigator.clipboard.writeText(clientLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <section className="bg-slate-900 text-white rounded-xl p-6">
      <p className="text-xs uppercase tracking-wider text-slate-400">Next build layer</p>
      <h2 className="text-xl font-semibold mt-1">Turn the brief into a client-ready design</h2>
      <div className="grid sm:grid-cols-2 gap-3 mt-5">
        {[
          ['01', 'Site photos & measurements', 'Capture the existing condition of each space.'],
          ['02', 'Design concepts', 'Create multiple options and select the recommended direction.'],
          ['03', 'Visualisation', 'Attach renders, moodboards and before/after comparisons.'],
          ['04', 'Estimate & approval', 'Present materials, scope, investment and collect approval.'],
        ].map(([number, title, text]) => (
          <div key={number} className="rounded-lg border border-slate-700 p-4"><span className="text-xs text-slate-400">{number}</span><h3 className="font-medium mt-1">{title}</h3><p className="text-sm text-slate-400 mt-1">{text}</p></div>
        ))}
      </div>
      <div className="mt-5 pt-5 border-t border-slate-700 flex flex-wrap gap-3">
        <button onClick={copyLink} className="px-4 py-2 rounded-lg bg-white text-slate-900 text-sm font-medium">{copied ? 'Link copied' : 'Copy client link'}</button>
        <span className="text-sm text-slate-400 self-center">The next database layer will make these areas fully editable and image-backed.</span>
      </div>
    </section>
  );
}
