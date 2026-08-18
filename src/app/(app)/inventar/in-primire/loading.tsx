// src/app/(app)/inventar/in-primire/loading.tsx
export default function SeIncarcaInPrimire() {
  return (
    <main className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-7 w-48 animate-pulse rounded" />
        <div className="bg-border h-4 w-96 max-w-full animate-pulse rounded" />
      </div>
      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: 4 }, (_, rand) => (
          <div key={rand} className="border-border h-24 w-full animate-pulse rounded-lg border" />
        ))}
      </div>
      <span className="sr-only">Se încarcă lista obiectelor în primire…</span>
    </main>
  );
}
