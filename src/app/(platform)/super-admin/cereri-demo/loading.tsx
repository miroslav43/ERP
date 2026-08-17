// src/app/(platform)/super-admin/cereri-demo/loading.tsx
const SCHELETE = [0, 1, 2] as const;

export default function IncarcareCereriDemo() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6" aria-busy="true">
      <p className="sr-only" role="status">
        Se încarcă cererile de demo.
      </p>
      <div className="bg-surface h-8 w-56 animate-pulse rounded-md" />
      <div className="bg-surface mt-3 h-4 w-full max-w-xl animate-pulse rounded-md" />
      <div className="mt-8 flex flex-wrap gap-2">
        {SCHELETE.map((index) => (
          <div key={index} className="bg-surface h-8 w-28 animate-pulse rounded-full" />
        ))}
      </div>
      <div className="mt-8 space-y-4">
        {SCHELETE.map((index) => (
          <div key={index} className="border-border rounded-lg border p-6">
            <div className="bg-surface h-5 w-48 animate-pulse rounded-md" />
            <div className="bg-surface mt-3 h-4 w-32 animate-pulse rounded-md" />
            <div className="bg-surface mt-6 h-16 w-full animate-pulse rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
