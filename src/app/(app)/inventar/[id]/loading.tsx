// src/app/(app)/inventar/[id]/loading.tsx
export default function SeIncarcaFisaObiect() {
  return (
    <main className="space-y-8 p-6">
      <div className="space-y-2">
        <div className="bg-border h-7 w-64 animate-pulse rounded" />
        <div className="bg-border h-4 w-40 animate-pulse rounded" />
      </div>
      {Array.from({ length: 3 }, (_, sectiune) => (
        <div
          key={sectiune}
          className="border-border space-y-3 rounded-lg border p-4"
          aria-hidden="true"
        >
          <div className="bg-border h-5 w-48 animate-pulse rounded" />
          <div className="bg-border h-4 w-full animate-pulse rounded" />
          <div className="bg-border h-4 w-5/6 animate-pulse rounded" />
        </div>
      ))}
      <span className="sr-only">Se încarcă fișa obiectului…</span>
    </main>
  );
}
