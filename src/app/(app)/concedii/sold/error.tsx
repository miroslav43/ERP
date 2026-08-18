// src/app/(app)/concedii/sold/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function EroareSoldConcedii({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <StareEroare
      titlu="Soldul de concediu nu a putut fi încărcat"
      eroare={error}
      reincearca={reset}
    />
  );
}
