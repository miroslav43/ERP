// src/app/(app)/revisal/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function EroareRevisal({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <StareEroare
      titlu="Evenimentele REVISAL nu au putut fi încărcate"
      eroare={error}
      reincearca={reset}
    />
  );
}
