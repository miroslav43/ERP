// src/app/(app)/pontaj/perioade/[id]/loading.tsx
export default function SeIncarcaPerioadaDetaliu() {
  return (
    <main className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-4 w-40 animate-pulse rounded" />
        <div className="bg-border h-7 w-56 animate-pulse rounded" />
        <div className="bg-border h-4 w-72 animate-pulse rounded" />
      </div>
      <div className="bg-border h-24 w-full animate-pulse rounded-lg" />
      <div className="space-y-3">
        <div className="bg-border h-24 w-full animate-pulse rounded-lg" />
        <div className="bg-border h-24 w-full animate-pulse rounded-lg" />
      </div>
    </main>
  );
}
