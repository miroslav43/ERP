"use client";

// src/app/(portal)/portal/masina-mea/rezervari/error.tsx
import type { ReactElement } from "react";

import { StareEroare } from "@/components/ui/stare-eroare";

export default function Eroare({
  error,
  retry,
}: {
  readonly error: Error & { digest?: string };
  readonly retry: () => void;
}): ReactElement {
  return (
    <div className="p-4">
      <StareEroare
        eroare={error}
        reincearca={retry}
        titlu="Rezervările nu au putut fi afișate"
        inapoi={{ eticheta: "Înapoi la Mașina mea", href: "/portal/masina-mea" }}
      />
    </div>
  );
}
