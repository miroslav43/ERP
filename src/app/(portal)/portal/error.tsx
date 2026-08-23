// src/app/(portal)/portal/error.tsx
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
      titlu="Portalul nu a putut fi încărcat"
      inapoi={{ eticheta: "Înapoi la pagina de start", href: "/portal" }}
    />
  );
}
