// src/app/(app)/concedii/aprobari/loading.tsx
export default function IncarcareAprobariConcedii() {
  return (
    <main className="space-y-6 p-6" aria-busy="true" aria-label="Se încarcă sarcinile de aprobat">
      <div className="h-8 w-48 animate-pulse rounded bg-surface" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-lg bg-surface" />
        ))}
      </div>
      <span className="sr-only">Se încarcă…</span>
    </main>
  );
}
