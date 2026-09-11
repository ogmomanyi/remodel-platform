type MaterialRef = {
  name?: string;
  category?: string;
  specification?: string;
};

type DesignCard = {
  id: string;
  spaceName: string;
  title: string;
  description: string | null;
  materials: MaterialRef[];
  costEstimate: number | null;
  currency: string;
  beforeImage?: string | null;
  beforeAlt?: string | null;
  afterImage?: string | null;
  afterAlt?: string | null;
};

export function ClientDesignVision({
  cards,
  totalQuote,
  preliminaries,
}: {
  cards: DesignCard[];
  totalQuote?: number | null;
  preliminaries?: number | null;
}) {
  if (!cards.length) return null;

  const money = new Intl.NumberFormat('en-KE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <section className="mb-10">
      <div className="mb-6 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Design vision</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-900">
          What we are proposing to build
        </h2>
        <p className="mt-3 text-sm leading-6 text-stone-600">
          The quotation has been translated into a visual design package so each intervention can be understood as a finished space, not just a line item.
        </p>
      </div>

      <div className="space-y-6">
        {cards.map((card, index) => (
          <article key={card.id} className="overflow-hidden rounded-[28px] border border-stone-200 bg-white">
            <div className="grid lg:grid-cols-[1.25fr_0.95fr]">
              <div className="p-5 md:p-7">
                <div className="grid gap-3 sm:grid-cols-2">
                  <VisualFrame
                    label="Existing condition"
                    image={card.beforeImage}
                    alt={card.beforeAlt || card.spaceName}
                    placeholder="Site photograph to be captured / assigned"
                  />
                  <VisualFrame
                    label="Proposed outcome"
                    image={card.afterImage}
                    alt={card.afterAlt || card.title}
                    placeholder="Client render brief ready for generation"
                    dark
                  />
                </div>
              </div>

              <div className="border-t border-stone-100 p-6 md:p-8 lg:border-l lg:border-t-0">
                <div className="flex items-center justify-between gap-4">
                  <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                    {card.spaceName}
                  </span>
                  <span className="text-xs text-stone-400">0{index + 1}</span>
                </div>

                <h3 className="mt-5 text-2xl font-semibold tracking-tight text-stone-900">{card.title}</h3>
                {card.description && (
                  <p className="mt-3 text-sm leading-6 text-stone-600">{card.description}</p>
                )}

                {!!card.materials.length && (
                  <div className="mt-6">
                    <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">Key specification</p>
                    <div className="mt-3 space-y-3">
                      {card.materials.slice(0, 5).map((material, materialIndex) => (
                        <div key={`${material.name || 'material'}-${materialIndex}`} className="flex gap-3">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-stone-900" />
                          <div>
                            <p className="text-sm font-medium text-stone-800">{material.name || 'Material'}</p>
                            {material.specification && (
                              <p className="mt-0.5 text-xs leading-5 text-stone-500">{material.specification}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {card.costEstimate !== null && (
                  <div className="mt-7 border-t border-stone-100 pt-5">
                    <p className="text-xs uppercase tracking-wider text-stone-400">Quoted scope value</p>
                    <p className="mt-1 text-xl font-semibold text-stone-900">
                      {card.currency} {money.format(card.costEstimate)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {(totalQuote || preliminaries) && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {preliminaries ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="text-xs uppercase tracking-wider text-stone-400">Preliminaries</p>
              <p className="mt-2 text-xl font-semibold">KES {money.format(preliminaries)}</p>
              <p className="mt-1 text-xs text-stone-500">County permit, tools/equipment, and health & safety provisions.</p>
            </div>
          ) : null}
          {totalQuote ? (
            <div className="rounded-2xl bg-stone-900 p-5 text-white">
              <p className="text-xs uppercase tracking-wider text-stone-400">Total quoted investment</p>
              <p className="mt-2 text-2xl font-semibold">KES {money.format(totalQuote)}</p>
              <p className="mt-1 text-xs text-stone-400">Based on the supplied contractor quotation.</p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

function VisualFrame({
  label,
  image,
  alt,
  placeholder,
  dark = false,
}: {
  label: string;
  image?: string | null;
  alt: string;
  placeholder: string;
  dark?: boolean;
}) {
  return (
    <figure className={`overflow-hidden rounded-2xl border ${dark ? 'border-stone-800 bg-stone-950' : 'border-stone-200 bg-stone-100'}`}>
      <div className="aspect-[4/3]">
        {image ? (
          <img src={image} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className={`flex h-full items-center justify-center p-6 text-center text-xs ${dark ? 'text-stone-500' : 'text-stone-400'}`}>
            {placeholder}
          </div>
        )}
      </div>
      <figcaption className={`border-t px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${dark ? 'border-stone-800 text-stone-400' : 'border-stone-200 text-stone-500'}`}>
        {label}
      </figcaption>
    </figure>
  );
}
