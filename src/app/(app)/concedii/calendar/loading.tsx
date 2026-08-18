// src/app/(app)/concedii/calendar/loading.tsx
export default function IncarcareCalendarConcedii() {
  return (
    <main className="space-y-6 p-6" aria-busy="true" aria-label="Se încarcă calendarul de concedii">
      <div className="h-8 w-64 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-96 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
      <span className="sr-only">Se încarcă…</span>
    </main>
  );
}
