// src/app/(platform)/super-admin/error.tsx
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
      titlu="Nu am putut încărca această pagină"
      descriere="Datele platformei nu au putut fi citite. Verificați conexiunea și încercați din nou."
    />
  );
}
