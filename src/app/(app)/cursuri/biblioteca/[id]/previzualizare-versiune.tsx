"use client";

// src/app/(app)/cursuri/biblioteca/[id]/previzualizare-versiune.tsx
//
// `linkPreviewMaterial` exista de la prima livrare fără niciun apelant:
// administratorul putea încărca un PDF sau un film, dar nu-l putea DESCHIDE
// niciodată din aplicație. Singurul om care vedea ce s-a urcat era angajatul —
// adică exact cel care n-are cum să repare o încărcare greșită.
//
// Tiparul de deschidere e cel din `angajati/[id]/documente/formular-document.tsx:173`:
// acțiunea întoarce un URL semnat cu TTL scurt, iar fila se deschide cu
// `noopener,noreferrer`. Bucket-ul e privat, deci nu există alt drum.

import { useState, useTransition } from "react";
import { Eye } from "lucide-react";

import { Buton } from "@/components/ui/buton";

import { linkPreviewMaterial } from "../../actions";

interface Proprietati {
  readonly versiuneId: string;
  readonly eticheta: string;
}

export function PrevizualizareVersiune({ versiuneId, eticheta }: Proprietati) {
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Deschide ${eticheta}`}
        disabled={inCurs}
        onClick={() => {
          setEroare(null);
          porneste(async () => {
            const rezultat = await linkPreviewMaterial({ version_id: versiuneId });
            if (!rezultat.ok) {
              setEroare(rezultat.error.message);
              return;
            }
            window.open(rezultat.data.url, "_blank", "noopener,noreferrer");
          });
        }}
      >
        <Eye className="size-4" aria-hidden="true" />
      </Buton>
      {eroare === null ? null : (
        <span role="alert" className="text-danger text-nota">
          {eroare}
        </span>
      )}
    </span>
  );
}
