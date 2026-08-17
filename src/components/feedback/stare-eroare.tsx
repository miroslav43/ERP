// src/components/feedback/stare-eroare.tsx
"use client";

import { RotateCcw } from "lucide-react";

type Props = Readonly<{
  titlu: string;
  eroare: Error & { digest?: string };
  reincearca: () => void;
}>;

export function StareEroare({ titlu, eroare, reincearca }: Props) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="border-border bg-surface m-6 rounded-lg border p-6"
    >
      <h2 className="text-foreground text-base font-semibold">{titlu}</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        Nu am putut încărca datele. Verificați conexiunea și reîncercați; dacă problema persistă,
        transmiteți-ne codul de mai jos.
      </p>
      <p className="text-muted-foreground mt-2 text-xs">
        Cod incident: {eroare.digest ?? "indisponibil"}
      </p>
      <button
        type="button"
        onClick={reincearca}
        className="bg-primary text-primary-foreground hover:bg-primary-hover focus-visible:ring-ring mt-4 inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
      >
        <RotateCcw aria-hidden="true" className="h-4 w-4" />
        Reîncearcă
      </button>
    </div>
  );
}
