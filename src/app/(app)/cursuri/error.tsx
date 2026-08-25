"use client";

// src/app/(app)/cursuri/error.tsx
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
    <StareEroare
      eroare={error}
      reincearca={retry}
      titlu="Cursurile nu au putut fi afișate"
      inapoi={{ eticheta: "Înapoi la panou", href: "/panou" }}
    />
  );
}
