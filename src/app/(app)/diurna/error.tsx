// src/app/(app)/diurna/error.tsx
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
    <StareEroare eroare={error} reincearca={retry} titlu="Deplasările nu au putut fi afișate" />
  );
}
