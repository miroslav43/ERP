// src/app/(app)/concedii/calendar/loading.tsx
export default function IncarcareCalendarConcedii() {
  return (
    <main className="space-y-6 p-6" aria-busy="true" aria-label="Se încarcă calendarul de concedii">
      <div className="bg-surface h-8 w-64 animate-pulse rounded" />
      <div className="bg-surface h-96 animate-pulse rounded-lg" />
      <span className="sr-only">Se încarcă…</span>
    </main>
  );
}
