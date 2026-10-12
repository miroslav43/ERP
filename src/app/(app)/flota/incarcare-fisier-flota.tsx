"use client";

// src/app/(app)/flota/incarcare-fisier-flota.tsx

import { Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Dialog } from "@/components/ui/dialog";
import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import { arataToast } from "@/components/ui/toast";
import { urcaPeUrlSemnat } from "@/lib/storage/urca-semnat";
import { LIMITA_FISIER_FLOTA_BYTES, MIME_FLOTA } from "@/domain/fleet/fisiere";

import {
  confirmaBon,
  confirmaScanareDocument,
  pregatesteBon,
  pregatesteScanareDocument,
} from "./actions-fisiere";

const ACCEPT = MIME_FLOTA.join(",");

/**
 * Ținta încărcării: scanarea unui document de vehicul sau poza bonului unei
 * alimentări (0199). Aceiași trei pași ca documentele de personal: semnarea pe
 * server, urcarea din browser, confirmarea cu mărimea REALĂ.
 */
export type TintaFisierFlota =
  | Readonly<{ fel: "scanare"; documentId: string; vehiculId: string }>
  | Readonly<{ fel: "bon"; alimentareId: string; foaieId: string }>;

interface Proprietati {
  readonly tinta: TintaFisierFlota;
  /** Ce se atașează, pentru numele accesibil al butonului: „RCA”, „bonul de 25 l”. */
  readonly descriere: string;
  /** Există deja un fișier: butonul îl ÎNLOCUIEȘTE, nu îl adaugă. */
  readonly areFisier: boolean;
}

/**
 * Butonul-iconiță din coloana „Acțiuni” și caseta lui de încărcare.
 *
 * Fișierul se urcă DIRECT la alegere, nu la un „Salvează” separat: caseta are o
 * singură decizie, iar un al doilea clic ar fi doar un loc în plus unde omul
 * poate pleca crezând că a terminat. Pe telefon, `accept` cu `image/*` deschide
 * camera — exact gestul șoferului la pompă.
 */
export function IncarcareFisierFlota({ tinta, descriere, areFisier }: Proprietati): ReactElement {
  const router = useRouter();
  const id = useId();
  const [deschis, setDeschis] = useState(false);
  const [runda, setRunda] = useState(0);
  const [problema, setProblema] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const eBon = tinta.fel === "bon";
  const verb = areFisier ? "Înlocuiește" : "Atașează";
  const ce = eBon ? "poza bonului" : "scanarea";

  function inchide(): void {
    if (inCurs) return;
    setDeschis(false);
    setProblema(null);
  }

  function incarca(fisier: File | null): void {
    setProblema(null);
    if (fisier === null) return;
    porneste(async () => {
      const declarat = {
        numeFisier: fisier.name,
        dimensiune: fisier.size,
        mime: fisier.type === "" ? "application/octet-stream" : fisier.type,
      };
      const pregatire =
        tinta.fel === "bon"
          ? await pregatesteBon({
              alimentare_id: tinta.alimentareId,
              trip_sheet_id: tinta.foaieId,
              ...declarat,
            })
          : await pregatesteScanareDocument({
              document_id: tinta.documentId,
              vehicle_id: tinta.vehiculId,
              ...declarat,
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
      const confirmare =
        tinta.fel === "bon"
          ? await confirmaBon({
              alimentare_id: tinta.alimentareId,
              trip_sheet_id: tinta.foaieId,
              cale: pregatire.data.cale,
            })
          : await confirmaScanareDocument({
              document_id: tinta.documentId,
              vehicle_id: tinta.vehiculId,
              cale: pregatire.data.cale,
              numeFisier: fisier.name,
            });
      if (!confirmare.ok) {
        setProblema(confirmare.error.message);
        return;
      }
      setRunda((r) => r + 1);
      setDeschis(false);
      arataToast({
        fel: "reusita",
        text: eBon ? "Poza bonului a fost atașată." : "Scanarea a fost atașată.",
      });
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`${verb} ${ce}: ${descriere}`}
        title={`${verb} ${ce}`}
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Paperclip className="size-4" aria-hidden="true" />
      </Buton>
      <Dialog
        deschis={deschis}
        laInchidere={inchide}
        titlu={`${verb} ${ce}`}
        descriere={
          eBon
            ? `Fotografia bonului de alimentare (${descriere}). Se păstrează lângă alimentare, pentru contabil.`
            : `Copia documentului „${descriere}”: poliță, certificat ITP, chitanță. Se păstrează pe fișa vehiculului.`
        }
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
            eticheta={eBon ? "Poza bonului" : "Fișierul scanat"}
            accept={ACCEPT}
            maxOcteti={LIMITA_FISIER_FLOTA_BYTES}
            mesajPreaMare="Fișierul depășește 20 MB."
            mesajTipRespins="Acceptăm doar PDF sau fotografii (JPG, PNG, WEBP, HEIC)."
            textAlegere={eBon ? "Fotografiază sau alege bonul" : "Alege fișierul"}
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
          {areFisier ? (
            <p className="text-muted-foreground text-nota">
              Fișierul nou îl înlocuiește pe cel de acum; cel vechi rămâne în arhivă.
            </p>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}
