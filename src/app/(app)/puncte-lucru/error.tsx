// src/app/(app)/puncte-lucru/error.tsx
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
    <StareEroare eroare={error} reset={reset} titlu="Punctele de lucru nu au putut fi afișate" />
  );
}
