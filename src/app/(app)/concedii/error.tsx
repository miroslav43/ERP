// src/app/(app)/concedii/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function EroareConcedii({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <StareEroare
      titlu="Cererile de concediu nu au putut fi încărcate"
      eroare={error}
      reincearca={reset}
    />
  );
}
