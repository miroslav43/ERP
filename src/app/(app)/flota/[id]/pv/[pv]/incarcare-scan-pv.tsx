"use client";

// src/app/(app)/flota/[id]/pv/[pv]/incarcare-scan-pv.tsx
//
// Scanul procesului-verbal semnat pe hârtie (0215, sub-commitul 8.8). Aceiași
// trei pași ca scanarea documentelor de vehicul (`incarcare-fisier-flota.tsx`):
// semnarea pe server, urcarea din browser, confirmarea cu mărimea REALĂ.
// Componentă proprie, nu o țintă nouă în `IncarcareFisierFlota`: aceea e
// editată de celelalte extensii ale flotei (bonul), iar fișierul acesta nu.

import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Dialog } from "@/components/ui/dialog";
import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import { arataToast } from "@/components/ui/toast";
import { urcaPeUrlSemnat } from "@/lib/storage/urca-semnat";
import { LIMITA_FISIER_FLOTA_BYTES, MIME_FLOTA } from "@/domain/fleet/fisiere";

import { confirmaScanPv, pregatesteScanPv } from "../actions";

const ACCEPT = MIME_FLOTA.join(",");

interface Proprietati {
  readonly pvId: string;
  readonly vehiculId: string;
  readonly numar: string;
  readonly areScan: boolean;
}

export function IncarcareScanPv({ pvId, vehiculId, numar, areScan }: Proprietati): ReactElement {
  const router = useRouter();
  const id = useId();
  const [deschis, setDeschis] = useState(false);
  const [runda, setRunda] = useState(0);
  const [problema, setProblema] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();
  const verb = areScan ? "Înlocuiește" : "Atașează";

  function inchide(): void {
    if (inCurs) return;
    setDeschis(false);
    setProblema(null);
  }

  function incarca(fisier: File | null): void {
    setProblema(null);
    if (fisier === null) return;
    porneste(async () => {
      const pregatire = await pregatesteScanPv({
        id: pvId,
        vehicle_id: vehiculId,
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
      const confirmare = await confirmaScanPv({
        id: pvId,
        vehicle_id: vehiculId,
        cale: pregatire.data.cale,
        numeFisier: fisier.name,
      });
      if (!confirmare.ok) {
        setProblema(confirmare.error.message);
        return;
      }
      setRunda((r) => r + 1);
      setDeschis(false);
      arataToast({ fel: "reusita", text: "Scanul procesului-verbal semnat a fost atașat." });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Paperclip className="size-4" aria-hidden="true" />
        {verb} scanul semnat
      </Buton>
      <Dialog
        deschis={deschis}
        laInchidere={inchide}
        titlu={`${verb} scanul procesului-verbal ${numar}`}
        descriere="Hârtia semnată de părți, scanată sau fotografiată. Se păstrează pe fișa vehiculului, lângă procesul-verbal."
        subsol={
          <Buton varianta="tertiar" disabled={inCurs} onClick={inchide}>
            Închide
          </Buton>
        }
      >
        <div className="space-y-2">
          <IncarcareFisier
            key={runda}
            nume="fisier"
            id={`${id}-fisier`}
            eticheta="Procesul-verbal semnat"
            accept={ACCEPT}
            maxOcteti={LIMITA_FISIER_FLOTA_BYTES}
            mesajPreaMare="Fișierul depășește 20 MB."
            mesajTipRespins="Acceptăm doar PDF sau fotografii (JPG, PNG, WEBP, HEIC)."
            textAlegere="Alege fișierul"
            etichetaScoate="Scoate fișierul"
            restrictii="PDF sau fotografie, până în 20 MB."
            laSchimbare={incarca}
            dezactivat={inCurs}
          />
          <div aria-live="polite" className="text-nota">
            {inCurs ? <p className="text-muted-foreground">Se încarcă fișierul…</p> : null}
            {problema === null ? null : (
              <p role="alert" className="text-danger">
                {problema}
              </p>
            )}
          </div>
          {areScan ? (
            <p className="text-muted-foreground text-nota">
              Fișierul nou îl înlocuiește pe cel de acum.
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
