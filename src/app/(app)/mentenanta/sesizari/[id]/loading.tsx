// src/app/(app)/mentenanta/sesizari/[id]/loading.tsx
export default function SeIncarcaSesizare() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-4 w-24 animate-pulse rounded" />
        <div className="bg-border h-7 w-72 animate-pulse rounded" />
      </div>
      <div className="bg-border h-48 w-full animate-pulse rounded-lg" />
      <div className="bg-border h-24 w-full animate-pulse rounded-lg" />
    </main>
  );
}
