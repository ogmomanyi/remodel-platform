type CatalogueAsset = {
  id: string;
  role: string;
  caption: string | null;
  url: string | null;
  alt: string;
};

export type ClientCatalogueBoard = {
  id: string;
  code: string;
  title: string;
  subtitle: string | null;
  type: string;
  narrative: string | null;
  features: string[];
  assets: CatalogueAsset[];
};

function roleLabel(role: string) {
  return role.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ClientVisualCatalogue({ boards }: { boards: ClientCatalogueBoard[] }) {
  if (!boards.length) return null;

  return (
    <section className="mb-12">
      <div className="mb-6 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Client visual catalogue</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">The proposal, page by page.</h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          Each board explains one part of the renovation using approved visual references, project-specific features and the design story for that zone.
        </p>
      </div>

      <div className="space-y-8">
        {boards.map((board) => {
          const hero = board.assets.find((asset) => asset.role === 'hero' || asset.role === 'after') ?? board.assets[0];
          const support = board.assets.filter((asset) => asset.id !== hero?.id);

          return (
            <article key={board.id} className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-sm">
              <div className="border-b border-stone-100 px-6 py-5 md:px-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-stone-400">{board.code}</p>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{board.title}</h3>
                    {board.subtitle && <p className="mt-1 text-sm italic text-stone-500">{board.subtitle}</p>}
                  </div>
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-600">
                    {roleLabel(board.type)}
                  </span>
                </div>
              </div>

              {hero?.url && (
                <div className="bg-stone-100 p-3 md:p-4">
                  <div className="relative overflow-hidden rounded-[1.4rem] bg-stone-900">
                    <img src={hero.url} alt={hero.alt} className="aspect-[16/9] w-full object-cover" />
                    <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-800 backdrop-blur">
                      {roleLabel(hero.role)}
                    </span>
                  </div>
                </div>
              )}

              <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div>
                  {board.narrative && <p className="text-sm leading-7 text-stone-700">{board.narrative}</p>}

                  {support.length > 0 && (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {support.map((asset) => (
                        <figure key={asset.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                          {asset.url && <img src={asset.url} alt={asset.alt} className="aspect-[4/3] w-full object-cover" />}
                          <figcaption className="p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400">{roleLabel(asset.role)}</p>
                            <p className="mt-1 text-xs leading-5 text-stone-600">{asset.caption || asset.alt}</p>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  )}
                </div>

                <aside className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-400">Key features</p>
                  <ul className="mt-4 space-y-3">
                    {board.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm leading-6 text-stone-700">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-stone-900" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </aside>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
