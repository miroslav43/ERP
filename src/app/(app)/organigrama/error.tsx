// src/app/(app)/organigrama/error.tsx
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
    <StareEroare eroare={error} reincearca={retry} titlu="Organigrama nu a putut fi afișată" />
  );
}
