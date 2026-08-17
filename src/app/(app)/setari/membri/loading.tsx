// src/app/(app)/setari/membri/loading.tsx
import { ScheletLista } from "@/components/feedback/schelet";

export default function Loading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Se încarcă lista de membri.
      </p>
      <ScheletLista randuri={5} />
    </>
  );
}
