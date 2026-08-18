// src/app/(app)/diurna/[id]/loading.tsx
export default function SeIncarcaDeplasare() {
  return (
    <main className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-4 w-24 animate-pulse rounded" />
        <div className="bg-border h-7 w-64 animate-pulse rounded" />
        <div className="bg-border h-4 w-80 max-w-full animate-pulse rounded" />
      </div>
      <div className="bg-border h-32 w-full animate-pulse rounded" />
      <div className="bg-border h-48 w-full animate-pulse rounded" />
      <div className="bg-border h-32 w-full animate-pulse rounded" />
    </main>
  );
}
