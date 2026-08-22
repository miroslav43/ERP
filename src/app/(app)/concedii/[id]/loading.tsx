// src/app/(app)/concedii/[id]/loading.tsx
export default function IncarcareDetaliuCerere() {
  return (
    <main
      className="space-y-6 p-6"
      aria-busy="true"
      aria-label="Se încarcă detaliile cererii de concediu"
    >
      <div className="bg-surface h-8 w-64 animate-pulse rounded" />
      <div className="bg-surface h-40 animate-pulse rounded-lg" />
      <div className="bg-surface h-32 animate-pulse rounded-lg" />
      <div className="bg-surface h-32 animate-pulse rounded-lg" />
      <span className="sr-only">Se încarcă…</span>
    </main>
  );
}
