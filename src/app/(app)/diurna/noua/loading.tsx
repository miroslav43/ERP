// src/app/(app)/diurna/noua/loading.tsx
export default function SeIncarcaDeplasareNoua() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-7 w-56 animate-pulse rounded" />
        <div className="bg-border h-4 w-96 max-w-full animate-pulse rounded" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="bg-border h-10 w-full animate-pulse rounded" />
          ))}
        </div>
        <div className="bg-border h-32 w-full animate-pulse rounded" />
      </div>
    </main>
  );
}
