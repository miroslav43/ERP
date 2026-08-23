// src/app/(platform)/super-admin/error.tsx
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
      titlu="Nu am putut încărca această pagină"
      descriere="Datele platformei nu au putut fi citite. Verificați conexiunea și încercați din nou."
    />
  );
}
