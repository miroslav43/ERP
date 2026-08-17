// src/components/data/skeleton-table.tsx
/**
 * Loading = schelet, nu spinner: păstrează dimensiunea conținutului, deci nu
 * produce salt de layout când datele sosesc.
 */
export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Se încarcă datele"
      className="border-border overflow-hidden rounded-lg border"
    >
      <div className="border-border bg-surface flex gap-4 border-b p-3">
        {Array.from({ length: cols }, (_, coloana) => (
          <div key={coloana} className="bg-border h-4 flex-1 animate-pulse rounded" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, rand) => (
        <div key={rand} className="border-border flex gap-4 border-b p-3 last:border-0">
          {Array.from({ length: cols }, (_, coloana) => (
            <div
              key={coloana}
              className="bg-border/70 h-4 flex-1 animate-pulse rounded"
              style={{ animationDelay: `${(rand % 4) * 80}ms` }}
            />
          ))}
        </div>
      ))}
      <span className="sr-only">Se încarcă datele…</span>
    </div>
  );
}
