// src/app/(app)/revisal/error.tsx
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
    <StareEroare
      eroare={error}
      reset={reset}
      titlu="Evenimentele REVISAL nu au putut fi încărcate"
    />
  );
}
