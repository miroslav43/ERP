"use client";

/** Singurul motiv pentru care decontul are o componentă client: `window.print()`. */
export function ButonTipar() {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
    >
      Tipărește
    </button>
  );
}
