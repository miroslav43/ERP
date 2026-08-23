// src/app/(app)/mentenanta/planuri/error.tsx
"use client";

import { StareEroare } from "@/components/ui/stare-eroare";

export default function Eroare({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <StareEroare
      eroare={error}
      reincearca={retry}
      titlu="Planurile de mentenanță nu au putut fi afișate"
    />
  );
}
