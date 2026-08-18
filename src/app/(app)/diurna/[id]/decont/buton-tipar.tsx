"use client";

/** Singurul motiv pentru care decontul are o componentă client: `window.print()`. */
export function ButonTipar() {
  return (
    <button
      type="button"
      onClick={() => {
        window.print();
      }}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
    >
      Tipărește
    </button>
  );
}
