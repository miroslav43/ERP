"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Paperclip } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";
import { BUCKET_CHECKLISTS, RESTRICTII_DOVADA, verificaDovada } from "@/lib/onboarding/cale";
import { getBrowserSupabase } from "@/lib/supabase/browser";

import { linkDovada, pregatesteIncarcareDovada, salveazaDovada } from "../actions";
import { useSemnalIncarcare } from "@/components/incarcare/use-incarcare";

/**
 * Încărcarea dovezii, direct în pas.
 *
 * ── CE ERA GREȘIT ─────────────────────────────────────────────────────────
 * Câmpul cerea UUID-ul unui rând din `employee_documents`, scris de mână, cu
 * ajutorul „Identificatorul documentului încărcat la fișa angajatului”. Nu
 * exista niciun upload în tot modulul — și nici nu putea exista: calea
 * documentelor de personal cere `employees:create`, pe care nici angajatul,
 * nici managerul nu-l au (D2). Migrarea 0092 a adus bucketul propriu.
 *
 * ── CUM E ACUM ────────────────────────────────────────────────────────────
 * Trei timpi, ca peste tot în proiect: acțiunea semnează calea, browserul urcă
 * octeții DIRECT în Storage, a doua acțiune înregistrează rândul. Octeții nu
 * trec prin server.
 *
 * `stadiu` e o uniune discriminată, iar mesajul din `lucru` alimentează
 * `textInCurs`: butonul spune exact la ce pas de rețea e, nu doar că „lucrează”.
 */

type Stadiu =
  | Readonly<{ tip: "inactiv" }>
  | Readonly<{ tip: "lucru"; mesaj: string }>
  | Readonly<{ tip: "eroare"; mesaj: string }>;

interface Proprietati {
  readonly pasId: string;
  readonly numeFisier: string | null;
  readonly marimeBytes: number | null;
  /** Fals ⇒ dovada se vede și se descarcă, dar nu se înlocuiește. */
  readonly poateScrie: boolean;
}

function marimeCitibila(octeti: number): string {
  if (octeti < 1024) return `${String(octeti)} B`;
  if (octeti < 1024 * 1024) return `${(octeti / 1024).toFixed(0)} KB`;
  return `${(octeti / (1024 * 1024)).toFixed(1)} MB`;
}

export function IncarcareDovada({ pasId, numeFisier, marimeBytes, poateScrie }: Proprietati) {
  const router = useRouter();
  const idCamp = useId();
  const intrare = useRef<HTMLInputElement>(null);
  const [stadiu, setStadiu] = useState<Stadiu>({ tip: "inactiv" });

  async function urca(fisier: File): Promise<void> {
    // Verificarea locală ÎNAINTE de orice drum la server: un fișier prea mare
    // n-are de ce să fie urcat ca să afle abia bucketul că e prea mare.
    const problema = verificaDovada({ size: fisier.size, type: fisier.type });
    if (problema !== null) {
      setStadiu({ tip: "eroare", mesaj: problema.mesaj });
      return;
    }

    setStadiu({ tip: "lucru", mesaj: "Se pregătește…" });
    const pregatire = await pregatesteIncarcareDovada({ id: pasId, nume_fisier: fisier.name });
    if (!pregatire.ok) {
      setStadiu({ tip: "eroare", mesaj: pregatire.error.message });
      return;
    }

    setStadiu({ tip: "lucru", mesaj: "Se încarcă…" });
    const urcare = await getBrowserSupabase()
      .storage.from(BUCKET_CHECKLISTS)
      .uploadToSignedUrl(pregatire.data.cale, pregatire.data.token, fisier);
    if (urcare.error !== null) {
      setStadiu({ tip: "eroare", mesaj: "Încărcarea fișierului nu a reușit." });
      return;
    }

    setStadiu({ tip: "lucru", mesaj: "Se înregistrează…" });
    const salvare = await salveazaDovada({
      id: pasId,
      cale: pregatire.data.cale,
      nume: fisier.name,
      mime: fisier.type,
      marime_bytes: fisier.size,
    });
    if (!salvare.ok) {
      // Obiectul a ajuns în Storage, dar rândul nu s-a scris. Nu-l ștergem de
      // aici: politica de DELETE nu există, iar curățarea trece prin
      // service_role, după audit. Omul află că trebuie să reîncerce.
      setStadiu({ tip: "eroare", mesaj: salvare.error.message });
      return;
    }

    setStadiu({ tip: "inactiv" });
    if (intrare.current !== null) intrare.current.value = "";
    arataToast({ fel: "reusita", text: "Dovada a fost atașată." });
    router.refresh();
  }

  const [seDescarca, setSeDescarca] = useState(false);
  useSemnalIncarcare(seDescarca, "documentul");

  async function descarca(): Promise<void> {
    if (seDescarca) return;
    setSeDescarca(true);
    try {
      const rezultat = await linkDovada({ id: pasId });
      if (!rezultat.ok) {
        setStadiu({ tip: "eroare", mesaj: rezultat.error.message });
        return;
      }
      /*
        `window.open` după un `await` a pierdut contextul de gest al
        utilizatorului, deci blocarea de ferestre îl poate opri TĂCUT: butonul
        se stinge, nu se deschide nimic, și nu apare nicio eroare. `open`
        întoarce `null` exact în cazul ăsta — atunci cădem pe navigarea în
        aceeași filă, care nu e blocabilă. Fișierul vine cu
        `content-disposition: attachment`, deci fila nu se pierde.
      */
      const fereastra = window.open(rezultat.data.url, "_blank", "noopener,noreferrer");
      if (fereastra === null) window.location.assign(rezultat.data.url);
    } finally {
      setSeDescarca(false);
    }
  }

  const inCurs = stadiu.tip === "lucru";

  return (
    <div className="space-y-2 sm:col-span-2">
      <p className="text-foreground text-corp font-medium">Document justificativ</p>

      {numeFisier === null ? (
        <p className="text-muted-foreground text-nota">Niciun fișier atașat. {RESTRICTII_DOVADA}</p>
      ) : (
        <div className="border-border bg-surface rounded-control flex flex-wrap items-center gap-2 border p-2">
          <Paperclip aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          <span className="text-corp min-w-0 flex-1 truncate">{numeFisier}</span>
          {marimeBytes === null ? null : (
            <span className="text-muted-foreground text-nota">{marimeCitibila(marimeBytes)}</span>
          )}
          <Buton
            varianta="tertiar"
            disabled={inCurs}
            inCurs={seDescarca}
            textInCurs="Se pregătește…"
            onClick={() => {
              void descarca();
            }}
          >
            <Download aria-hidden="true" className="size-3.5" />
            Descarcă
          </Buton>
        </div>
      )}

      {poateScrie ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={intrare}
            id={idCamp}
            type="file"
            disabled={inCurs}
            className="text-corp file:border-border file:bg-surface file:text-foreground file:rounded-control file:mr-3 file:border file:px-3 file:py-1.5"
            onChange={(e) => {
              const fisier = e.target.files?.[0];
              if (fisier !== undefined) void urca(fisier);
            }}
          />
          {inCurs ? (
            <span className="text-muted-foreground text-nota inline-flex items-center gap-1">
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
              {stadiu.mesaj}
            </span>
          ) : null}
        </div>
      ) : null}

      {stadiu.tip === "eroare" ? (
        <p role="alert" className="text-danger text-nota">
          {stadiu.mesaj}
        </p>
      ) : null}
    </div>
  );
}
