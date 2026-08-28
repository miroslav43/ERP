// src/components/incarcare/panou-incarcare.tsx
"use client";

import { useEffect, useState, type ReactElement } from "react";

import { Rotita } from "./rotita";
import type { MesajIncarcare } from "@/lib/incarcare/stiati-ca";
import { PRAG_INTARZIERE, PRAG_MESAJ, ROTATIE_MESAJ } from "@/lib/incarcare/praguri";

/**
 * Ce se vede în mijlocul voalului.
 *
 * Componenta se montează ABIA când voalul devine vizibil, deci toate
 * cronometrele de aici pornesc de la zero exact atunci — nu trebuie corelate cu
 * momentul în care a început așteptarea.
 *
 * ── DE CE `import()` DINAMIC PENTRU MESAJE ────────────────────────────────
 * Cele 100 de mesaje sunt ~14 KB de text. Voalul stă în layout-ul RĂDĂCINĂ,
 * deci ar intra și în bundle-ul paginilor publice de prezentare, unde nu apare
 * niciodată. Aduse la `PRAG_MESAJ`, nu se descarcă decât la o așteptare care
 * chiar a trecut de o secundă — adică rar, și niciodată pe landing.
 */
export function PanouIncarcare({
  eticheta,
}: Readonly<{ eticheta?: string | undefined }>): ReactElement {
  const [mesaj, setMesaj] = useState<MesajIncarcare | null>(null);
  const [intarziat, setIntarziat] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIntarziat(true), PRAG_INTARZIERE);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let activ = true;
    let rotatie: ReturnType<typeof setInterval> | undefined;

    const pornire = setTimeout(() => {
      // Importul poate eșua (rețea căzută tocmai la mijlocul unei așteptări).
      // Atunci voalul rămâne cu rotița și textul — degradare, nu cădere.
      void import("@/lib/incarcare/stiati-ca")
        .then(({ mesajAleator }) => {
          if (!activ) return;
          let curent = mesajAleator();
          setMesaj(curent);
          rotatie = setInterval(() => {
            curent = mesajAleator(curent.text);
            setMesaj(curent);
          }, ROTATIE_MESAJ);
        })
        .catch(() => undefined);
    }, PRAG_MESAJ);

    return () => {
      activ = false;
      clearTimeout(pornire);
      if (rotatie !== undefined) clearInterval(rotatie);
    };
  }, []);

  const titlu = eticheta === undefined ? "Se încarcă…" : `Se încarcă ${eticheta}…`;

  return (
    <div className="border-border bg-background rounded-panou shadow-plutitor pointer-events-auto flex w-full max-w-md flex-col gap-3 border p-5">
      <p className="text-foreground text-corp flex items-center gap-3 font-medium">
        <Rotita className="text-primary shrink-0" />
        <span>{intarziat ? "Durează mai mult decât de obicei…" : titlu}</span>
      </p>

      {mesaj === null ? null : (
        <div className="border-border flex flex-col gap-1 border-t pt-3">
          <p className="text-muted-foreground text-eticheta tracking-wide uppercase">
            {mesaj.categorie}
          </p>
          {/*
            `key` pe text, nu pe index: fără el React refolosește nodul și
            schimbarea mesajului trece neobservată — exact efectul pe care
            rotația îl combate.
          */}
          <p key={mesaj.text} className="text-foreground text-corp">
            {mesaj.text}
          </p>
        </div>
      )}
    </div>
  );
}
