// src/app/(app)/mentenanta/interventii/error.tsx
"use client";

import { StareEroare } from "@/components/ui/stare-eroare";

export default function Eroare({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <StareEroare eroare={error} reset={reset} titlu="Intervențiile nu au putut fi afișate" />;
}
