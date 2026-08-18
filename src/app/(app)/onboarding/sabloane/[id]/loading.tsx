// src/app/(app)/onboarding/sabloane/[id]/loading.tsx
export default function SeIncarcaSablon() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-4 w-24 animate-pulse rounded" />
        <div className="bg-border h-7 w-64 animate-pulse rounded" />
        <div className="bg-border h-4 w-48 animate-pulse rounded" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-border h-16 w-full animate-pulse rounded-lg" />
        ))}
      </div>
    </main>
  );
}
