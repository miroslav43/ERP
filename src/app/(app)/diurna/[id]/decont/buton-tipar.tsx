"use client";

/** Singurul motiv pentru care decontul are o componentă client: `window.print()`. */
export function ButonTipar() {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium"
    >
      Tipărește
    </button>
  );
}
