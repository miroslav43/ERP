// src/app/(app)/onboarding/sabloane/[id]/error.tsx
"use client";

import { StareEroare } from "@/components/ui/stare-eroare";

export default function Eroare({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <StareEroare eroare={error} reset={reset} titlu="Șablonul nu a putut fi afișat" />;
}
