// src/app/(app)/concedii/aprobari/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function EroareAprobariConcedii({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <StareEroare
      titlu="Lista de aprobări nu a putut fi încărcată"
      eroare={error}
      reincearca={reset}
    />
  );
}
