'use client';

export function PrintCatalogueButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-stone-800"
    >
      Print / Save PDF
    </button>
  );
}
