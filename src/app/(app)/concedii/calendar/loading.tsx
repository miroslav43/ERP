// src/app/(app)/concedii/calendar/loading.tsx
export default function IncarcareCalendarConcedii() {
  return (
    <main className="space-y-6 p-6" aria-busy="true" aria-label="Se încarcă calendarul de concedii">
      <div className="h-8 w-64 animate-pulse rounded bg-surface" />
      <div className="h-96 animate-pulse rounded-lg bg-surface" />
      <span className="sr-only">Se încarcă…</span>
    </main>
  );
}
