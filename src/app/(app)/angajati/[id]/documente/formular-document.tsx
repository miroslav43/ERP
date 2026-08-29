// src/app/(app)/angajati/[id]/documente/formular-document.tsx
"use client";
import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { ActionResult } from "@/lib/actions/types";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { BUCKET_DOCUMENTE, verificaDocument } from "@/lib/documents/cale";
import {
  linkDescarcareDocument,
  pregatesteIncarcareDocument,
  salveazaDocument,
  stergeDocument,
} from "./actions";

/**
 * Un refuz construit pe client, în forma exactă a lui `ActionResult`.
 *
 * Încărcarea unui document nu e o singură Server Action, ci trei pași —
 * pregătirea căii semnate, urcarea în bucket, salvarea rândului — iar primii
 * doi pot eșua fără să treacă vreodată prin `create-action.ts`. Ca `Formular`
 * să le arate la fel ca pe restul (mesaj pe câmp, `Callout` altfel), refuzul se
 * îmbracă aici în același tip.
 */
function refuzLocal(mesaj: string, camp?: string): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message: mesaj,
      fieldErrors: camp === undefined ? null : { [camp]: [mesaj] },
      requestId: "client",
    },
  };
}

type TipDocument = {
  id: string;
  denumire: string;
  confidential_implicit: boolean;
  vizibil_angajatului_implicit: boolean;
};

/**
 * Adăugarea unui document în dosar, într-o casetă.
 *
 * Formularul stătea PERMANENT deschis deasupra listei, pe trei coloane: pe un
 * dosar cu douăzeci de acte, primul lucru de pe ecran era un formular gol, iar
 * lista — motivul pentru care omul a intrat pe pagină — începea sub el.
 *
 * ── DE CE `actiune` ÎNTOARCE UN `ActionResult` COMPUS ─────────────────────
 * Încărcarea are trei pași: `pregatesteIncarcareDocument` dă o cale semnată,
 * fișierul urcă direct în bucket din browser, iar `salveazaDocument` scrie
 * rândul. Numai primul și ultimul sunt Server Actions. Pașii care nu trec prin
 * `create-action.ts` își îmbracă refuzul cu `refuzLocal`, ca `Formular` să-l
 * arate la fel ca pe oricare altul — inclusiv verificarea de tip MIME și de
 * dimensiune, care se face în browser tocmai ca să nu urce 20 MB degeaba.
 */
export function FormularDocument({
  employeeId,
  tipuri,
}: {
  employeeId: string;
  tipuri: readonly TipDocument[];
}) {
  const referinta = useRef<HTMLInputElement>(null);

  async function trimite(formular: FormData): Promise<ActionResult<{ id: string }>> {
    const fisier = referinta.current?.files?.[0];
    const tipId = String(formular.get("tip") ?? "");
    const titlu = String(formular.get("titlu") ?? "").trim();
    if (!fisier) return refuzLocal("Alegeți un fișier.", "fisier");

    const problema = verificaDocument(fisier.type, fisier.size);
    if (problema !== null) return refuzLocal(problema, "fisier");

    const pregatire = await pregatesteIncarcareDocument({
      employeeId,
      numeFisier: fisier.name,
      dimensiune: fisier.size,
      mime: fisier.type,
    });
    if (!pregatire.ok) return refuzLocal(pregatire.error.message);

    const urcare = await getBrowserSupabase()
      .storage.from(BUCKET_DOCUMENTE)
      .uploadToSignedUrl(pregatire.data.cale, pregatire.data.token, fisier);
    if (urcare.error !== null) {
      return refuzLocal("Încărcarea a eșuat. Verificați conexiunea.", "fisier");
    }

    const tip = tipuri.find((t) => t.id === tipId);
    return salveazaDocument({
      employeeId,
      documentTypeId: tipId,
      titlu,
      cale: pregatire.data.cale,
      numeFisier: fisier.name,
      dimensiune: fisier.size,
      mime: fisier.type,
      confidential: tip?.confidential_implicit ?? true,
      vizibilAngajatului: tip?.vizibil_angajatului_implicit ?? true,
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Adaugă document",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Document nou în dosar"
      descriere="Tipul documentului decide singur dacă actul e confidențial și dacă angajatul îl vede în portal. Fișierele acceptate: PDF și imagini, până la 20 MB."
      marime="mare"
      actiune={trimite}
      mesajReusita="Documentul a fost adăugat în dosar."
      etichetaTrimite="Adaugă documentul"
      textInCurs="Se încarcă…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="tip"
            id={idc("tip")}
            eticheta="Tip document"
            fel="select"
            obligatoriu
            erori={stare.erori["tip"] ?? []}
          >
            {(a) => (
              <select {...a} defaultValue={stare.valoriTrimise["tip"] ?? ""}>
                {tipuri.map((tip) => (
                  <option key={tip.id} value={tip.id}>
                    {tip.denumire}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <Camp
            nume="titlu"
            id={idc("titlu")}
            eticheta="Titlu"
            obligatoriu
            erori={stare.erori["titlu"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={200}
                defaultValue={stare.valoriTrimise["titlu"] ?? ""}
              />
            )}
          </Camp>

          {/* Fișierul NU trece prin `valoriTrimise`: un `<input type="file">`
              nu poate primi o valoare din cod, deci nici nu poate fi repus
              după un refuz. Rămâne pe referință, ca înainte. */}
          <Camp
            nume="fisier"
            id={idc("fisier")}
            eticheta="Fișier"
            ajutor="PDF sau imagine, cel mult 20 MB."
            obligatoriu
            className="sm:col-span-2"
            erori={stare.erori["fisier"] ?? []}
          >
            {(a) => <input {...a} ref={referinta} type="file" />}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}

export function ListaDescarcare({
  documentId,
  numeFisier,
}: {
  documentId: string;
  numeFisier: string;
}) {
  const [eroare, setEroare] = useState<string | null>(null);
  async function descarca(): Promise<void> {
    const rezultat = await linkDescarcareDocument({ documentId });
    if (!rezultat.ok) {
      setEroare(rezultat.error.message);
      return;
    }
    window.open(rezultat.data.url, "_blank", "noopener,noreferrer");
  }
  return (
    <span className="flex items-center gap-2">
      {eroare !== null && (
        <span role="alert" className="text-danger text-corp">
          {eroare}
        </span>
      )}
      <Buton
        varianta="secundar"
        onClick={() => {
          void descarca();
        }}
      >
        Descarcă <span className="sr-only">{numeFisier}</span>
      </Buton>
    </span>
  );
}

/**
 * Retragerea unui document din dosar.
 *
 * Cerea motivul într-un câmp apărut ÎN rândul tabelului, între „Descarcă" și
 * „Renunță": rândul se lățea, coloanele săreau, iar butonul distructiv ajungea
 * la câțiva pixeli de cel de descărcare. Acum e o casetă, cu spațiu pentru
 * propoziția care spune ce se întâmplă.
 *
 * Rămâne o RETRAGERE, nu o ștergere: `stergeDocument` marchează rândul cu
 * `deleted_at` și păstrează fișierul — nicio politică DELETE nu există în
 * schemă. Motivul intră în audit și e obligatoriu.
 */
export function ButonStergeDocument({
  documentId,
  poateSterge,
}: {
  documentId: string;
  poateSterge: boolean;
}) {
  if (!poateSterge) return null;

  async function trimite(date: FormData) {
    return stergeDocument({ documentId, motiv: String(date.get("motiv") ?? "") });
  }

  return (
    <FormularDialog
      declansator={{ eticheta: "Retrage din dosar", varianta: "distructiv" }}
      titlu="Retrage documentul din dosar"
      descriere="Documentul dispare din dosarul angajatului și din portalul lui. Fișierul se păstrează, iar motivul retragerii intră în jurnalul de audit."
      marime="mediu"
      actiune={trimite}
      mesajReusita="Documentul a fost retras din dosar."
      etichetaTrimite="Retrage documentul"
      variantaTrimite="distructiv"
      textInCurs="Se retrage…"
    >
      {(stare, idc) => (
        <Camp
          nume="motiv"
          id={idc("motiv")}
          eticheta="Motivul retragerii"
          fel="textarea"
          obligatoriu
          ajutor="Cel puțin 3 caractere. Se vede în jurnalul de audit, nu de către angajat."
          erori={stare.erori["motiv"] ?? []}
        >
          {(a) => (
            <textarea
              {...a}
              rows={3}
              maxLength={500}
              defaultValue={stare.valoriTrimise["motiv"] ?? ""}
            />
          )}
        </Camp>
      )}
    </FormularDialog>
  );
}
