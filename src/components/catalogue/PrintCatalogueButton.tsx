'use client';

export function PrintCatalogueButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm print:hidden"
    >
      Print / Save PDF
    </button>
  );
}
