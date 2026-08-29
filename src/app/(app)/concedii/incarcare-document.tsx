// src/app/(app)/concedii/incarcare-document.tsx
"use client";

import { useState, useTransition } from "react";

import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import {
  BUCKET_DOCUMENTE,
  LIMITA_DOCUMENT_BYTES,
  MIME_ACCEPTATE,
  verificaDocument,
} from "@/lib/documents/cale";
import { explicatieOriginalFizic, modDocument } from "@/domain/leave/documente-fizice";

import { pregatesteIncarcareDocumentConcediu } from "./actions";

/**
 * Documentul justificativ al unei cereri de concediu.
 *
 * ── CE ÎNLOCUIEȘTE ────────────────────────────────────────────────────────
 * În ecranul de resurse umane, un câmp de TEXT numit „Calea documentului
 * justificativ (opțional)", cu exemplul `concedii/2026/certificat-123.pdf`.
 * Nimeni n-are de unde ști calea unui obiect din Storage, iar dacă o ghicea,
 * fișierul tot nu exista acolo: nimic nu-l urca. Câmpul cerea o referință
 * către un lucru pe care platforma nu-l primea niciodată.
 *
 * În portal, nici atât: formularul trimitea `atasament_path: null` scris în
 * cod. Cum `internal.leave_requests_pregateste` respinge trimiterea unui tip cu
 * `necesita_document` fără atașament, angajatul primea un P0001 care îi cerea
 * un document pe care ecranul nu-i dădea nicio cale să-l ofere. Nouă tipuri
 * din treisprezece nu se puteau trimite deloc din portal.
 *
 * ── DE CE URCĂ DIRECT DIN BROWSER ─────────────────────────────────────────
 * Serverul dă doar calea și un jeton semnat; octeții merg de la browser în
 * Storage. Un PDF de 20 MB trecut prin `FormData` către o Server Action ar
 * traversa serverul degeaba și ar lovi limita de corp a cererii.
 *
 * ── CALEA AJUNGE ÎN FORMULAR PRINTR-UN CÂMP ASCUNS ────────────────────────
 * `atasament_path` e cheia din `creeazaCerereSchema`, deci `fieldErrors`
 * întors de acțiune găsește câmpul. Cererea se creează DUPĂ ce fișierul e sus:
 * dacă omul renunță între timp, în Storage rămâne un obiect orfan — preferabil
 * unei cereri care trimite spre un fișier inexistent.
 */

const ACCEPT = MIME_ACCEPTATE.join(",");

export function IncarcareDocumentConcediu({
  cheieTip,
  necesitaDocument,
  employeeId = null,
  erori,
}: {
  /** `leave_types.key` al tipului selectat acum; `null` cât timp nu s-a ales. */
  readonly cheieTip: string | null;
  readonly necesitaDocument: boolean;
  /** `null` = cererea e pentru mine însumi. Ecranul de resurse umane trimite fișa aleasă. */
  readonly employeeId?: string | null;
  readonly erori?: readonly string[];
}) {
  const [cale, setCale] = useState<string | null>(null);
  const [numeUrcat, setNumeUrcat] = useState<string | null>(null);
  const [problema, setProblema] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const mod = modDocument(cheieTip, necesitaDocument);
  const explicatie = explicatieOriginalFizic(cheieTip);

  if (mod === "nu") return null;

  function incarca(fisier: File | null): void {
    setProblema(null);
    if (fisier === null) {
      setCale(null);
      setNumeUrcat(null);
      return;
    }

    // Verificat în browser înainte de orice drum la server: un fișier de 40 MB
    // n-are de ce să fie urcat ca să afle abia bucketul că e prea mare.
    const respins = verificaDocument(fisier.type, fisier.size);
    if (respins !== null) {
      setProblema(respins);
      return;
    }

    porneste(async () => {
      const pregatire = await pregatesteIncarcareDocumentConcediu({
        employee_id: employeeId,
        nume_fisier: fisier.name,
      });
      if (!pregatire.ok) {
        setProblema(pregatire.error.message);
        return;
      }

      const urcare = await getBrowserSupabase()
        .storage.from(BUCKET_DOCUMENTE)
        .uploadToSignedUrl(pregatire.data.cale, pregatire.data.token, fisier);
      if (urcare.error !== null) {
        setProblema("Încărcarea documentului nu a reușit. Încercați din nou.");
        return;
      }

      setCale(pregatire.data.cale);
      setNumeUrcat(fisier.name);
    });
  }

  const obligatoriu = mod === "incarcare";

  return (
    <div className="sm:col-span-2">
      <IncarcareFisier
        nume="fisier_document"
        eticheta={obligatoriu ? "Document justificativ" : "Document justificativ (opțional)"}
        accept={ACCEPT}
        maxOcteti={LIMITA_DOCUMENT_BYTES}
        mesajPreaMare="Fișierul depășește 20 MB."
        mesajTipRespins="Acceptăm doar PDF, imagini (JPG, PNG, WEBP), Word sau Excel."
        textAlegere="Alege documentul"
        etichetaScoate="Scoate documentul"
        restrictii={
          obligatoriu
            ? "PDF, imagine, Word sau Excel, până în 20 MB. Fără el, cererea nu poate fi trimisă."
            : "PDF, imagine, Word sau Excel, până în 20 MB."
        }
        laSchimbare={incarca}
        {...(erori === undefined ? {} : { erori })}
      />

      {/*
        Calea, nu fișierul: octeții au plecat deja direct în Storage. Câmpul
        poartă exact numele cheii din schemă, ca `fieldErrors` să-l găsească.
      */}
      <input type="hidden" name="atasament_path" value={cale ?? ""} />

      <div aria-live="polite" className="text-nota mt-1">
        {inCurs ? <p className="text-muted-foreground">Se încarcă documentul…</p> : null}
        {problema !== null ? (
          <p role="alert" className="text-danger">
            {problema}
          </p>
        ) : null}
        {cale !== null && !inCurs ? (
          <p className="text-muted-foreground">Documentul „{numeUrcat}” a fost încărcat.</p>
        ) : null}
      </div>

      {/*
        Pentru cele trei acte care pleacă mai departe pe hârtie, explicația NU e
        o notă de subsol: e singurul loc din produs care spune de ce copia
        încărcată nu închide dosarul. Fără ea, „aduceți originalul" arată ca o
        birocrație inventată de firmă.
      */}
      {explicatie === null ? null : (
        <p className="border-warning/40 bg-warning/12 text-foreground rounded-control text-nota mt-2 border p-3">
          <strong className="font-medium">Originalul se predă pe hârtie.</strong> {explicatie}{" "}
          Fișierul încărcat aici e doar o copie, ca resursele umane să știe din timp despre ce e
          vorba — nu înlocuiește originalul.
        </p>
      )}
    </div>
  );
}
