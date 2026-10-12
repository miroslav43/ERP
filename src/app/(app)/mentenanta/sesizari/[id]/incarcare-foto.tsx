"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import { arataToast } from "@/components/ui/toast";
import { urcaPeUrlSemnat } from "@/lib/storage/urca-semnat";
import { LIMITA_FOTO_BYTES, MAXIM_FOTO_PE_SESIZARE, MIME_FOTO } from "@/schemas/maintenance";

import { confirmaFisier, pregatesteFisier } from "../actions";

const ACCEPT = MIME_FOTO.join(",");

/**
 * Fotografia unei defecțiuni, în trei pași: acțiunea semnează calea, browserul
 * urcă octeții direct în Storage, a treia acțiune scrie rândul cu mărimea și
 * tipul citite de pe server. O poză de 4 MB nu traversează Server Action-ul.
 *
 * Câmpul se remontează după fiecare încărcare reușită (`key`), ca să fie gol
 * pentru următoarea; pagina se reîmprospătează, deci galeria o arată.
 */
export function IncarcareFoto({
  sesizareId,
  existente,
}: Readonly<{ sesizareId: string; existente: number }>): ReactElement | null {
  const router = useRouter();
  const [runda, setRunda] = useState(0);
  const [problema, setProblema] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const ramase = MAXIM_FOTO_PE_SESIZARE - existente;
  if (ramase <= 0) {
    return (
      <p className="text-muted-foreground text-nota">
        Sesizarea are deja {MAXIM_FOTO_PE_SESIZARE} fotografii, maximul. Ștergeți una ca să adăugați
        alta.
      </p>
    );
  }

  function incarca(fisier: File | null): void {
    setProblema(null);
    if (fisier === null) return;

    porneste(async () => {
      const pregatire = await pregatesteFisier({
        entity_type: "fault_report",
        entity_id: sesizareId,
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
        setProblema(
          "Încărcarea fotografiei nu a reușit. Verificați conexiunea și încercați din nou.",
        );
        return;
      }

      const confirmare = await confirmaFisier({
        entity_type: "fault_report",
        entity_id: sesizareId,
        cale: pregatire.data.cale,
        denumire: fisier.name,
        tip: "foto",
      });
      if (!confirmare.ok) {
        setProblema(confirmare.error.message);
        return;
      }

      setRunda((r) => r + 1);
      arataToast({ fel: "reusita", text: "Fotografia a fost adăugată." });
      router.refresh();
    });
  }

  return (
    <div className="space-y-1">
      <IncarcareFisier
        key={runda}
        nume="fotografie"
        eticheta={existente === 0 ? "Adăugați o fotografie" : "Adăugați încă o fotografie"}
        accept={ACCEPT}
        maxOcteti={LIMITA_FOTO_BYTES}
        mesajPreaMare="Fotografia depășește 5 MB."
        mesajTipRespins="Acceptăm fotografii JPG, PNG, WEBP sau HEIC."
        textAlegere="Alege fotografia"
        etichetaScoate="Scoate fotografia"
        restrictii={`JPG, PNG, WEBP sau HEIC, până în 5 MB. Mai încap ${String(ramase)} din ${String(MAXIM_FOTO_PE_SESIZARE)}.`}
        laSchimbare={incarca}
        dezactivat={inCurs}
      />
      <div aria-live="polite" className="text-nota">
        {inCurs ? <p className="text-muted-foreground">Se încarcă fotografia…</p> : null}
        {problema !== null ? (
          <p role="alert" className="text-danger">
            {problema}
          </p>
        ) : null}
      </div>
    </div>
  );
}
