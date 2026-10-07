"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import { arataToast } from "@/components/ui/toast";
import { urcaPeUrlSemnat } from "@/lib/storage/urca-semnat";
import {
  LIMITA_DOCUMENT_MENTENANTA_BYTES,
  MIME_DOCUMENT_MENTENANTA,
  TIPURI_ATASAMENT,
  type EntitateAtasament,
  type TipAtasament,
} from "@/schemas/maintenance";

import { ETICHETE_TIP_ATASAMENT } from "../../etichete";
import { confirmaFisier, pregatesteFisier } from "../../sesizari/actions";

const ACCEPT = MIME_DOCUMENT_MENTENANTA.join(",");
const TIPURI_DOCUMENT: readonly TipAtasament[] = TIPURI_ATASAMENT.filter((t) => t !== "foto");

/**
 * Un document pe echipament (carte tehnică, certificat CE, manual, contract,
 * factură) — aceiași trei pași ca fotografia sesizării, în `maintenance_attachments`
 * cu `entity_type = 'equipment'`. Tipul se alege ÎNAINTE de fișier, ca rândul
 * să-l poarte de la început; documentele legale nu se șterg fizic din bucket.
 */
export function IncarcareDocument({
  entityType,
  entityId,
}: Readonly<{ entityType: EntitateAtasament; entityId: string }>): ReactElement {
  const router = useRouter();
  const id = useId();
  const [tip, setTip] = useState<TipAtasament>("carte_tehnica");
  const [runda, setRunda] = useState(0);
  const [problema, setProblema] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  function incarca(fisier: File | null): void {
    setProblema(null);
    if (fisier === null) return;
    porneste(async () => {
      const pregatire = await pregatesteFisier({
        entity_type: entityType,
        entity_id: entityId,
        numeFisier: fisier.name,
        dimensiune: fisier.size,
        mime: fisier.type === "" ? "application/octet-stream" : fisier.type,
      });
      if (!pregatire.ok) {
        setProblema(pregatire.error.message);
        return;
      }
      const urcat = await urcaPeUrlSemnat(pregatire.data.urlSemnat, fisier);
      if (!urcat) {
        setProblema("Încărcarea nu a reușit. Verificați conexiunea și încercați din nou.");
        return;
      }
      const confirmare = await confirmaFisier({
        entity_type: entityType,
        entity_id: entityId,
        cale: pregatire.data.cale,
        denumire: fisier.name,
        tip,
      });
      if (!confirmare.ok) {
        setProblema(confirmare.error.message);
        return;
      }
      setRunda((r) => r + 1);
      arataToast({ fel: "reusita", text: "Documentul a fost adăugat." });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[14rem_1fr]">
      <Camp nume="tip_document" id={`${id}-tip`} eticheta="Tipul documentului" fel="select">
        {(a) => (
          <select
            {...a}
            value={tip}
            onChange={(e) => {
              setTip(e.target.value as TipAtasament);
            }}
          >
            {TIPURI_DOCUMENT.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP_ATASAMENT[t]}
              </option>
            ))}
          </select>
        )}
      </Camp>
      <div className="space-y-1">
        <IncarcareFisier
          key={runda}
          nume="document"
          eticheta="Fișier"
          accept={ACCEPT}
          maxOcteti={LIMITA_DOCUMENT_MENTENANTA_BYTES}
          mesajPreaMare="Documentul depășește 25 MB."
          mesajTipRespins="Acceptăm PDF, Word sau fotografii (JPG, PNG, WEBP, HEIC)."
          textAlegere="Alege documentul"
          etichetaScoate="Scoate documentul"
          restrictii="PDF, Word sau fotografie, până în 25 MB."
          laSchimbare={incarca}
          dezactivat={inCurs}
        />
        <div aria-live="polite" className="text-nota">
          {inCurs ? <p className="text-muted-foreground">Se încarcă documentul…</p> : null}
          {problema !== null ? (
            <p role="alert" className="text-danger">
              {problema}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
