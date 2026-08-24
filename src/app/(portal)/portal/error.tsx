// src/app/(portal)/portal/error.tsx
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
      titlu="Portalul nu a putut fi încărcat"
      inapoi={{ eticheta: "Înapoi la pagina de start", href: "/portal" }}
    />
  );
}
