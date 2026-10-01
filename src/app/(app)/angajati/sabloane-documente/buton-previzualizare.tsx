// src/app/(app)/angajati/sabloane-documente/buton-previzualizare.tsx
"use client";

import { Eye } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Dialog } from "@/components/ui/dialog";
import type { CodInrolare } from "@/lib/documents/variabile";

/**
 * „Previzualizează PDF" — documentul așa cum ar ieși la export, din textul aflat
 * ÎN EDITOR, nesalvat.
 *
 * ── DE CE CITEȘTE DIN `FormData`, NU DINTR-UN STATE RIDICAT ────────────────
 * Conținutul trăiește în `EditorSablon`, într-un input ascuns pe care îl
 * actualizează la fiecare tastă. Ridicarea lui până aici ar fi însemnat un
 * state partajat între editor, formular și butonul ăsta — trei locuri care se
 * pot desincroniza — pentru o valoare de care e nevoie o dată, la apăsare.
 * Butonul stă în același `<form>`, iar `closest("form")` de pe ținta evenimentului
 * îi dă exact ce s-ar trimite la salvare. Previzualizarea nu poate diverge de ce
 * ar fi salvat. (`Buton` nu înaintează `ref`, deci evenimentul e și singura cale.)
 *
 * ── DE CE DIALOG CU `<iframe>`, NU O FILĂ NOUĂ ─────────────────────────────
 * `window.open` după un `await` nu mai e „gest al utilizatorului" pentru
 * blocatoarele de ferestre, deci fila s-ar deschide uneori și alteori nu, fără
 * nicio explicație pentru om. `<iframe>` pe un blob URL merge de fiecare dată,
 * iar cine vrea totuși fila are butonul din subsolul casetei — apăsat direct,
 * deci gest al utilizatorului.
 */
export function ButonPrevizualizare({
  cod,
  inCurs,
}: Readonly<{ cod: CodInrolare; inCurs: boolean }>): React.ReactElement {
  const [adresa, setAdresa] = useState<string | null>(null);
  const [eroare, setEroare] = useState<string | null>(null);
  const [seIncarca, setSeIncarca] = useState(false);

  /*
   * Fiecare previzualizare ține un `Blob` în memoria filei până la
   * `revokeObjectURL`. Un PDF de câteva sute de kiloocteți × zece apăsări în
   * timp ce omul își aranjează textul e o scurgere care nu se vede decât pe o
   * filă lăsată deschisă o zi.
   */
  useEffect(
    () => () => {
      if (adresa !== null) URL.revokeObjectURL(adresa);
    },
    [adresa],
  );

  const inchide = useCallback(() => {
    setAdresa((veche) => {
      if (veche !== null) URL.revokeObjectURL(veche);
      return null;
    });
  }, []);

  const previzualizeaza = useCallback(
    async (formular: HTMLFormElement) => {
      const date = new FormData(formular);
      setEroare(null);
      setSeIncarca(true);
      try {
        const raspuns = await fetch("/api/sabloane-documente/previzualizare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            cod,
            denumire: String(date.get("denumire") ?? ""),
            continut_html: String(date.get("continut_html") ?? ""),
          }),
        });

        if (!raspuns.ok) {
          // Ruta răspunde cu text simplu, în română, gata de afișat: aceleași
          // mesaje ca la salvare, ca omul să nu învețe două vocabulare.
          setEroare((await raspuns.text()) || "Previzualizarea nu a putut fi generată.");
          return;
        }

        const fisier = await raspuns.blob();
        setAdresa((veche) => {
          if (veche !== null) URL.revokeObjectURL(veche);
          return URL.createObjectURL(fisier);
        });
      } catch {
        setEroare("Previzualizarea nu a putut fi generată. Verifică legătura la internet.");
      } finally {
        setSeIncarca(false);
      }
    },
    [cod],
  );

  return (
    <>
      <Buton
        varianta="secundar"
        type="button"
        disabled={inCurs}
        inCurs={seIncarca}
        textInCurs="Se pregătește…"
        onClick={(eveniment) => {
          const formular = eveniment.currentTarget.closest("form");
          if (formular !== null) void previzualizeaza(formular);
        }}
      >
        <Eye aria-hidden="true" className="size-4" />
        Previzualizează PDF
      </Buton>

      {eroare === null ? null : (
        <Callout fel="eroare" titlu="Previzualizarea nu a putut fi generată">
          {eroare}
        </Callout>
      )}

      <Dialog
        deschis={adresa !== null}
        laInchidere={inchide}
        titlu="Previzualizare"
        descriere="Documentul cu date de exemplu, exact prin randarea folosită la export. Nu s-a emis și nu s-a înregistrat nimic."
        marime="lucru"
        subsol={
          <>
            <Buton
              varianta="secundar"
              type="button"
              onClick={() => {
                if (adresa !== null) window.open(adresa, "_blank", "noopener");
              }}
            >
              Deschide în filă nouă
            </Buton>
            <Buton varianta="primar" type="button" onClick={inchide}>
              Închide
            </Buton>
          </>
        }
      >
        {adresa === null ? null : (
          <iframe src={adresa} title="Previzualizarea documentului" className="h-[70vh] w-full" />
        )}
      </Dialog>
    </>
  );
}
