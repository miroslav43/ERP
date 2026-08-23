// src/app/(app)/mentenanta/echipamente/[id]/error.tsx
"use client";

import { StareEroare } from "@/components/ui/stare-eroare";

export default function Eroare({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StareEroare eroare={error} reset={reset} titlu="Fișa echipamentului nu a putut fi afișată" />
  );
}
