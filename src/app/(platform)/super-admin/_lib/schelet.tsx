// src/app/(platform)/super-admin/_lib/schelet.tsx
type ProprietatiSchelet = Readonly<{ randuri?: number; titlu?: string }>;

/** Schelet de încărcare — păstrează forma ecranului, nu un spinner gol. */
export function Schelet({ randuri = 6, titlu = "Se încarcă datele…" }: ProprietatiSchelet) {
  const chei = Array.from({ length: randuri }, (_, index) => index);
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">{titlu}</span>
      <div className="bg-surface h-7 w-64 animate-pulse rounded-md" />
      <div className="border-border bg-surface rounded-xl border p-4">
        <div className="space-y-3">
          {chei.map((cheie) => (
            <div key={cheie} className="flex items-center gap-4">
              <div className="bg-background h-4 w-1/3 animate-pulse rounded" />
              <div className="bg-background h-4 w-1/4 animate-pulse rounded" />
              <div className="bg-background ml-auto h-6 w-16 animate-pulse rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
