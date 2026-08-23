// src/app/(app)/concedii/sold/error.tsx
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
    <StareEroare eroare={error} reset={reset} titlu="Soldul de concediu nu a putut fi încărcat" />
  );
}
