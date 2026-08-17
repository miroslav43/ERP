// src/components/feedback/schelet.tsx
export function ScheletLista({ randuri = 4 }: Readonly<{ randuri?: number }>) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3 p-6">
      <div className="bg-surface h-6 w-48 animate-pulse rounded" />
      {Array.from({ length: randuri }, (_, indice) => (
        <div key={indice} className="bg-surface h-16 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}

export function ScheletCarduri({ carduri = 6 }: Readonly<{ carduri?: number }>) {
  return (
    <div aria-hidden="true" className="grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: carduri }, (_, indice) => (
        <div key={indice} className="bg-surface h-28 animate-pulse rounded-lg" />
      ))}
    </div>
  );
}
