"use client";

// src/app/(app)/cursuri/biblioteca/[id]/incarcare-versiune.tsx
//
// Încărcarea în TREI pași, ca la documentele de personal: octeții merg direct
// din browser în Storage, nu prin serverul nostru. `client_max_body_size 25M`
// din nginx e deci irelevant — un film de 200 MB nu trece pe acolo.
//
//   1. Server Action: validează, construiește calea, semnează încărcarea.
//   2. Client: `uploadToSignedUrl`.
//   3. Server Action: verifică semnătura de fișier (magic bytes) și scrie rândul.
//
// Pasul 3 e cel care contează: MIME-ul trimis la pasul 1 e cel DECLARAT de
// browser. Abia serverul, citind primii octeți ai obiectului deja urcat, poate
// spune dacă „filmul" e într-adevăr un film.

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Camp } from "@/components/ui/camp";
import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import { arataToast } from "@/components/ui/toast";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  BUCKET_CURSURI,
  LIMITA_PDF_BYTES,
  LIMITA_VIDEO_BYTES,
  MIME_PDF,
  MIME_VIDEO,
  RESTRICTII_INCARCARE,
  verificaMaterial,
  type FelMaterial,
} from "@/lib/media/cale";

import { pregatesteIncarcareMaterial, salveazaVersiuneFisier } from "../../actions";

interface Proprietati {
  readonly materialId: string;
  readonly fel: FelMaterial;
  readonly cereDurata: boolean;
}

type Stare =
  | Readonly<{ tip: "inactiv" }>
  | Readonly<{ tip: "lucru"; mesaj: string }>
  | Readonly<{ tip: "eroare"; mesaj: string }>;

export function IncarcareVersiune({ materialId, fel, cereDurata }: Proprietati) {
  const router = useRouter();
  const [stare, setStare] = useState<Stare>({ tip: "inactiv" });
  const [fisier, setFisier] = useState<File | null>(null);
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  const trimite = useCallback(
    async (eveniment: React.FormEvent<HTMLFormElement>): Promise<void> => {
      eveniment.preventDefault();
      const date = new FormData(eveniment.currentTarget);
      if (fisier === null) {
        setStare({ tip: "eroare", mesaj: "Alegeți un fișier." });
        return;
      }

      // A doua verificare, deși `<IncarcareFisier>` a filtrat deja: un fișier
      // tras din altă filă poate avea zero octeți și trece de `accept`.
      const problema = verificaMaterial(fel, fisier.type, fisier.size);
      if (problema !== null) {
        setStare({ tip: "eroare", mesaj: problema });
        return;
      }

      const durata = String(date.get("durata_secunde") ?? "");
      if (cereDurata && durata === "") {
        setStare({
          tip: "eroare",
          mesaj: "Completați durata filmului: fără ea, parcurgerea nu se poate măsura.",
        });
        return;
      }

      setStare({ tip: "lucru", mesaj: "Se pregătește încărcarea…" });
      const pregatire = await pregatesteIncarcareMaterial({
        material_id: materialId,
        fel,
        nume_fisier: fisier.name,
        dimensiune: fisier.size,
        mime: fisier.type,
        este_subtitrare: false,
      });
      if (!pregatire.ok) {
        setStare({ tip: "eroare", mesaj: pregatire.error.message });
        return;
      }

      setStare({ tip: "lucru", mesaj: "Se încarcă fișierul…" });
      const urcare = await getBrowserSupabase()
        .storage.from(BUCKET_CURSURI)
        .uploadToSignedUrl(pregatire.data.cale, pregatire.data.token, fisier);
      if (urcare.error !== null) {
        setStare({ tip: "eroare", mesaj: "Încărcarea a eșuat. Verificați conexiunea." });
        return;
      }

      setStare({ tip: "lucru", mesaj: "Se verifică fișierul…" });
      const salvat = await salveazaVersiuneFisier({
        material_id: materialId,
        cale: pregatire.data.cale,
        nume_fisier: fisier.name,
        mime: fisier.type,
        subtitrare_cale: null,
        durata_secunde: durata === "" ? null : durata,
        numar_pagini: String(date.get("numar_pagini") ?? ""),
        nota_versiune: String(date.get("nota_versiune") ?? ""),
      });
      if (!salvat.ok) {
        setStare({ tip: "eroare", mesaj: salvat.error.message });
        return;
      }

      setStare({ tip: "inactiv" });
      setFisier(null);
      arataToast({ fel: "reusita", text: "Versiunea a fost încărcată." });
      router.refresh();
    },
    [cereDurata, fel, fisier, materialId, router],
  );

  const inCurs = stare.tip === "lucru";

  return (
    <form onSubmit={trimite} className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <IncarcareFisier
          nume="fisier"
          id={idc("fisier")}
          eticheta={fel === "pdf" ? "Document PDF" : "Fișier video"}
          accept={(fel === "pdf" ? MIME_PDF : MIME_VIDEO).join(",")}
          restrictii={RESTRICTII_INCARCARE[fel]}
          textAlegere="Alegeți fișierul"
          etichetaScoate="Scoate fișierul"
          maxOcteti={fel === "pdf" ? LIMITA_PDF_BYTES : LIMITA_VIDEO_BYTES}
          mesajPreaMare={
            fel === "pdf"
              ? "Fișierul depășește 25 MB."
              : "Filmul depășește 200 MB. Comprimați-l sau folosiți un link extern."
          }
          obligatoriu
          laSchimbare={setFisier}
        />
      </div>

      {fel === "video" ? (
        <Camp
          nume="durata_secunde"
          id={idc("durata_secunde")}
          eticheta="Durata filmului (secunde)"
          obligatoriu={cereDurata}
          ajutor="Se completează aici, nu se citește de la player: altfel numitorul dovezii ar fi ales chiar de cel măsurat."
        >
          {(a) => <input {...a} type="number" min={1} max={86400} />}
        </Camp>
      ) : (
        <Camp nume="numar_pagini" id={idc("numar_pagini")} eticheta="Număr de pagini">
          {(a) => <input {...a} type="number" min={1} max={5000} />}
        </Camp>
      )}

      <Camp nume="nota_versiune" id={idc("nota_versiune")} eticheta="Notă de versiune">
        {(a) => <input {...a} type="text" maxLength={500} placeholder="Ce s-a schimbat" />}
      </Camp>

      {stare.tip === "eroare" ? (
        <div className="sm:col-span-2">
          <Callout fel="eroare" titlu="Încărcarea nu a reușit">
            {stare.mesaj}
          </Callout>
        </div>
      ) : null}

      <BaraActiuni className="sm:col-span-2">
        <Buton
          type="submit"
          varianta="primar"
          inCurs={inCurs}
          textInCurs={stare.tip === "lucru" ? stare.mesaj : "Se încarcă…"}
          disabled={fisier === null}
        >
          Încarcă versiunea
        </Buton>
      </BaraActiuni>
    </form>
  );
}
