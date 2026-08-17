// src/app/(app)/setari/organizatie/loading.tsx
import { ScheletLista } from "@/components/feedback/schelet";

export default function Loading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Se încarcă datele firmei.
      </p>
      <ScheletLista randuri={6} />
    </>
  );
}
