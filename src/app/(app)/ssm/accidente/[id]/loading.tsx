// src/app/(app)/ssm/accidente/[id]/loading.tsx
export default function SeIncarcaAccident() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div className="space-y-2">
        <div className="bg-border h-4 w-32 animate-pulse rounded" />
        <div className="bg-border h-7 w-64 animate-pulse rounded" />
      </div>
      <div className="bg-border h-40 w-full animate-pulse rounded-lg" />
      <div className="bg-border h-24 w-full animate-pulse rounded-lg" />
    </main>
  );
}
