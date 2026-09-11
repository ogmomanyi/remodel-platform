export type ProjectScaleMetric = {
  label: string;
  value: string;
  note?: string;
  kind: 'quoted' | 'derived';
};

export function ProjectScaleOverview({ metrics }: { metrics: ProjectScaleMetric[] }) {
  if (!metrics.length) return null;

  const quoted = metrics.filter((metric) => metric.kind === 'quoted');
  const derived = metrics.filter((metric) => metric.kind === 'derived');

  return (
    <section className="mb-10 rounded-[2rem] border border-stone-200 bg-white p-6 md:p-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Project scale</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">How substantial is the intervention?</h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Quoted quantities are taken directly from the contractor BOQ. Derived dimensions are planning estimates calculated from those quantities and are not substitutes for measured site dimensions or fabrication drawings.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quoted.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
      </div>

      {derived.length > 0 && (
        <div className="mt-8 border-t border-stone-100 pt-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">Derived</span>
            <p className="text-sm font-medium text-stone-700">Planning estimates from BOQ geometry</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {derived.map((metric) => <MetricCard key={metric.label} metric={metric} />)}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricCard({ metric }: { metric: ProjectScaleMetric }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">{metric.label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{metric.value}</p>
      {metric.note && <p className="mt-2 text-xs leading-5 text-stone-500">{metric.note}</p>}
    </div>
  );
}
