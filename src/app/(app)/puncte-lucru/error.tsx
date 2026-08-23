// src/app/(app)/puncte-lucru/error.tsx
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
      titlu="Punctele de lucru nu au putut fi afișate"
    />
  );
}
