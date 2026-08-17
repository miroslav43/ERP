// src/app/(platform)/super-admin/loading.tsx
import { Schelet } from "./_components/insigne";

export default function IncarcarePlatforma() {
  return (
    <div aria-busy="true" aria-live="polite" className="space-y-4">
      <span className="sr-only">Se încarcă datele platformei…</span>
      <Schelet className="h-8 w-64" />
      <Schelet className="h-24 w-full" />
      {[0, 1, 2, 3, 4].map((rand) => (
        <Schelet key={rand} className="h-12 w-full" />
      ))}
    </div>
  );
}
