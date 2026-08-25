"use client";

// src/app/(app)/cursuri/[id]/error.tsx
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
      titlu="Cursul nu a putut fi afișat"
      inapoi={{ eticheta: "Înapoi la cursuri", href: "/cursuri" }}
    />
  );
}
