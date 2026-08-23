// src/app/(app)/pontaj/perioade/[id]/error.tsx
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
    <StareEroare eroare={error} reincearca={retry} titlu="Lotul de aprobare nu a putut fi afișat" />
  );
}
