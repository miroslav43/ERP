// src/app/(app)/ssm/accidente/[id]/error.tsx
"use client";

import { StareEroare } from "@/components/ui/stare-eroare";

export default function Eroare({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <StareEroare eroare={error} reincearca={retry} titlu="Accidentul nu a putut fi afișat" />;
}
