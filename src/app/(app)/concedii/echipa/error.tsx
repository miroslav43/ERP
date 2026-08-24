// src/app/(app)/concedii/echipa/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function EroareConcediiEchipa({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <StareEroare
      titlu="Cererile de concediu ale echipei nu au putut fi încărcate"
      eroare={error}
      reincearca={reset}
    />
  );
}
