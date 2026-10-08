"use client";

// src/app/(app)/registru/previzualizare-pdf.tsx
//
// Cadrul cu PDF-ul unui document emis, montat LA CERERE.
//
// Ruta `/documente/[id]?format=pdf` randează PDF-ul la fiecare cerere, cu
// `no-store`. Montat odată cu panoul, fiecare clic pe un rând de document emis
// ar fi însemnat un PDF generat pe server pe care omul poate nici nu-l cere.
// Butonul face costul opțional și vizibil.

import { Eye } from "lucide-react";
import { useId, useState } from "react";

import { Buton } from "@/components/ui/buton";

export function PrevizualizarePdf({ src }: { readonly src: string }) {
  const [aratat, setAratat] = useState(false);
  const id = useId();

  if (aratat) {
    return (
      <iframe
        id={id}
        src={src}
        title="Previzualizarea PDF-ului"
        className="border-border rounded-panou h-[70vh] w-full border"
      />
    );
  }

  return (
    <Buton type="button" varianta="secundar" onClick={() => setAratat(true)} aria-controls={id}>
      <Eye aria-hidden="true" className="size-4" />
      Previzualizează PDF
    </Buton>
  );
}
