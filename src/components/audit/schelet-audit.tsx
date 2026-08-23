// src/components/audit/schelet-audit.tsx
const LINII = [0, 1, 2, 3, 4, 5, 6, 7];

export function ScheletAudit() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Se încarcă jurnalul de audit…</span>
      <div className="border-border bg-surface rounded-panou h-40 animate-pulse border" />
      <div className="border-border rounded-panou overflow-hidden border">
        <div className="bg-surface h-10 animate-pulse" />
        {LINII.map((linie) => (
          <div key={linie} className="border-border flex gap-3 border-t px-3 py-3">
            <div className="bg-surface h-4 w-40 animate-pulse rounded" />
            <div className="bg-surface h-4 w-48 animate-pulse rounded" />
            <div className="bg-surface h-4 w-32 animate-pulse rounded" />
            <div className="bg-surface h-4 w-24 animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
