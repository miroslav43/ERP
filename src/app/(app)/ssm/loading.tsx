// src/app/(app)/ssm/loading.tsx
export default function SeIncarcaSsm() {
  return (
    <main className="space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-7 w-48 animate-pulse rounded" />
        <div className="bg-border h-4 w-96 animate-pulse rounded" />
      </div>
      <div className="bg-border h-10 w-full animate-pulse rounded" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="bg-border h-28 animate-pulse rounded-lg" />
        ))}
      </div>
    </main>
  );
}
