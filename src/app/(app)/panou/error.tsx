// src/app/(app)/panou/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function Error({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return <StareEroare titlu="Panoul nu s-a putut încărca" eroare={error} reincearca={reset} />;
}
