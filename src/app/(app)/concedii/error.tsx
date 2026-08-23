// src/app/(app)/concedii/error.tsx
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
      titlu="Cererile de concediu nu au putut fi încărcate"
    />
  );
}
