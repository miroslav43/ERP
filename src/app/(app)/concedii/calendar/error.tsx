// src/app/(app)/concedii/calendar/error.tsx
"use client";

import { StareEroare } from "@/components/feedback/stare-eroare";

export default function EroareCalendarConcedii({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <StareEroare
      titlu="Calendarul de concedii nu a putut fi încărcat"
      eroare={error}
      reincearca={reset}
    />
  );
}
