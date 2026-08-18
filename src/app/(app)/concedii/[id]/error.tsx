// src/app/(app)/concedii/[id]/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function EroareDetaliuCerere({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <StareEroare
      titlu="Cererea de concediu nu a putut fi încărcată"
      eroare={error}
      reincearca={reset}
    />
  );
}
