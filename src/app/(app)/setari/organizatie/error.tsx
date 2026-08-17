// src/app/(app)/setari/organizatie/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function Error({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <StareEroare titlu="Datele firmei nu s-au putut încărca" eroare={error} reincearca={reset} />
  );
}
