// src/app/(app)/concedii/setari/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function EroareSetariConcedii({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <StareEroare
      titlu="Setările de concedii nu au putut fi încărcate"
      eroare={error}
      reincearca={reset}
    />
  );
}
