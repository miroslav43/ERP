// src/app/(app)/panou/loading.tsx
import { ScheletCarduri } from "@/components/feedback/schelet";

export default function Loading() {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        Se încarcă panoul.
      </p>
      <ScheletCarduri />
    </>
  );
}
