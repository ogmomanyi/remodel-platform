type SiteContextProps = {
  projectCode: string;
};

export function ClientSiteContext({ projectCode }: SiteContextProps) {
  if (projectCode !== 'PRJ-2026-004') return null;

  return (
    <section className="mb-10 overflow-hidden rounded-[2rem] border border-stone-200 bg-white">
      <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-stone-100 p-5 md:p-7">
          <div className="overflow-hidden rounded-[1.5rem] border border-stone-200 bg-[#d7d0c3]">
            <svg viewBox="0 0 900 560" role="img" aria-label="Diagrammatic aerial site context showing the Lower Kabete house and the white terrace renovation zone" className="h-auto w-full">
              <rect width="900" height="560" fill="#d8d1c4" />
              <path d="M0 410 C180 350 260 360 400 410 C560 470 690 455 900 380 L900 560 L0 560 Z" fill="#9caf87" />
              <path d="M0 0 H900 V140 C760 120 660 105 520 115 C360 127 180 95 0 130 Z" fill="#7f8f72" opacity=".65" />

              <path d="M140 115 L335 75 L510 120 L480 250 L300 280 L175 225 Z" fill="#7e5a47" stroke="#604234" strokeWidth="8" />
              <path d="M455 105 L640 95 L735 175 L665 285 L500 250 Z" fill="#8a5e45" stroke="#644331" strokeWidth="8" />
              <path d="M560 260 L760 250 L815 390 L630 410 L540 340 Z" fill="#875b43" stroke="#63422f" strokeWidth="8" />

              <path d="M260 260 L495 235 L560 340 L330 390 L220 330 Z" fill="#faf9f4" stroke="#f8f7f1" strokeWidth="14" />
              <path d="M330 390 L560 340 L610 385 L395 445 Z" fill="#f2efe8" opacity=".9" />

              <path d="M740 40 C770 100 820 145 900 160" stroke="#a89f91" strokeWidth="36" fill="none" opacity=".8" />
              <path d="M780 430 C820 455 855 475 900 490" stroke="#a89f91" strokeWidth="30" fill="none" opacity=".75" />

              <circle cx="387" cy="307" r="12" fill="#111827" />
              <path d="M387 307 C365 307 348 324 348 345 C348 378 387 411 387 411 C387 411 426 378 426 345 C426 324 409 307 387 307 Z" fill="#111827" opacity=".92" />
              <circle cx="387" cy="345" r="11" fill="#faf9f4" />

              <rect x="35" y="35" width="245" height="76" rx="18" fill="rgba(255,255,255,.9)" />
              <text x="58" y="66" fontSize="20" fontWeight="700" fill="#1c1917">Lower Kabete Spring House No. 09</text>
              <text x="58" y="91" fontSize="15" fill="#57534e">Diagrammatic site context · not to scale</text>

              <rect x="565" y="438" width="295" height="76" rx="18" fill="rgba(255,255,255,.94)" />
              <rect x="588" y="458" width="26" height="26" rx="6" fill="#faf9f4" stroke="#a8a29e" />
              <text x="628" y="477" fontSize="17" fontWeight="700" fill="#1c1917">Renovation zone</text>
              <text x="628" y="500" fontSize="14" fill="#57534e">Existing white terrace / canopy apron</text>
            </svg>
          </div>
        </div>

        <div className="p-6 md:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Site context</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">The renovation stays within the existing terrace footprint.</h2>
          <p className="mt-4 text-sm leading-6 text-stone-600">
            The supplied aerial reference shows the intervention concentrated on the bright/white terrace and canopy strip immediately adjoining the main house. The proposal is therefore treated as a surgical renovation of this zone—not an extension of the overall residence.
          </p>

          <div className="mt-6 space-y-4">
            <Constraint title="Renovate" text="White terrace/canopy apron, lounge-facing interface, garden-edge planter." />
            <Constraint title="Retain" text="Existing brown tiled roofs, main house massing, driveway, established garden and unrelated structures." />
            <Constraint title="Visualisation rule" text="Future renders must preserve the actual property massing and keep all new work inside the identified renovation zone." />
          </div>

          <p className="mt-6 rounded-2xl bg-stone-50 p-4 text-xs leading-5 text-stone-500">
            This diagram is derived from the supplied aerial imagery and is for design communication only. Final setting-out and dimensions must be verified by site survey before construction.
          </p>
        </div>
      </div>
    </section>
  );
}

function Constraint({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stone-900" />
      <div>
        <p className="text-sm font-semibold text-stone-900">{title}</p>
        <p className="mt-1 text-sm leading-6 text-stone-600">{text}</p>
      </div>
    </div>
  );
}
