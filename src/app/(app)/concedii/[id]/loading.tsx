// src/app/(app)/concedii/[id]/loading.tsx
export default function IncarcareDetaliuCerere() {
  return (
    <main
      className="space-y-6 p-6"
      aria-busy="true"
      aria-label="Se încarcă detaliile cererii de concediu"
    >
      <div className="h-8 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      <div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      <span className="sr-only">Se încarcă…</span>
    </main>
  );
}
