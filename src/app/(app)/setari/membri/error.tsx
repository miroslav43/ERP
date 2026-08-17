// src/app/(app)/setari/membri/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function Error({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <StareEroare titlu="Membrii nu s-au putut încărca" eroare={error} reincearca={reset} />;
}
