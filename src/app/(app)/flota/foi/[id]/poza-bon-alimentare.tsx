"use client";

// src/app/(app)/flota/foi/[id]/poza-bon-alimentare.tsx

import { useId, useState, useTransition, type ReactElement } from "react";

import { IncarcareFisier } from "@/components/ui/incarcare-fisier";
import { FotoBonNecitibila, pregatesteFotoBon } from "@/lib/documents/foto-bon-pregatire";
import { urcaPeUrlSemnat } from "@/lib/storage/urca-semnat";
import { LIMITA_FISIER_FLOTA_BYTES } from "@/domain/fleet/fisiere";

import { pregatesteBonNou } from "../../bon/actions";

export type BonUrcat = Readonly<{ cale: string; nume: string }>;

type Props = Readonly<{
  foaieId: string;
  /** Poza s-a urcat (sau s-a scos, cu `null`). */
  laSchimbare: (bon: BonUrcat | null) => void;
}>;

/**
 * Poza bonului în formularul „Adaugă o alimentare”, ÎNAINTE de salvare (F12a):
 * fără ea nu există ce citi. Pașii: JPEG ≤ 2048 px în browser (fără EXIF, deci
 * fără GPS), semnarea căii pe server (`pregatesteBonNou`, sub sesiunea omului),
 * urcarea directă. Rândul îl leagă `adaugaAlimentare`, la salvare.
 *
 * `accept="image/*"`, FĂRĂ `image/heic`: pe iPhone, selectorul convertește
 * atunci singur fotografia în JPEG (F12a E18). Un HEIC copiat pe un calculator
 * cu Chrome nu se poate decoda: omul primește pașii, poza nu se urcă (M5).
 */
export function PozaBonAlimentare({ foaieId, laSchimbare }: Props): ReactElement {
  const id = useId();
  const [inCurs, porneste] = useTransition();
  const [problema, setProblema] = useState<string | null>(null);
  const [urcat, setUrcat] = useState<string | null>(null);

  function alege(fisier: File | null): void {
    setProblema(null);
    setUrcat(null);
    laSchimbare(null);
    if (fisier === null) return;
    porneste(async () => {
      let jpeg: File;
      try {
        jpeg = await pregatesteFotoBon(fisier);
      } catch (eroare) {
        setProblema(
          eroare instanceof FotoBonNecitibila
            ? eroare.message
            : "Fotografia nu a putut fi pregătită. Încercați din nou.",
        );
        return;
      }
      const pregatire = await pregatesteBonNou({
        trip_sheet_id: foaieId,
        numeFisier: jpeg.name,
        dimensiune: jpeg.size,
        mime: jpeg.type,
      });
      if (!pregatire.ok) {
        setProblema(pregatire.error.message);
        return;
      }
      const reusit = await urcaPeUrlSemnat(pregatire.data.urlSemnat, jpeg);
      if (!reusit) {
        setProblema("Încărcarea nu a reușit. Verificați conexiunea și încercați din nou.");
        return;
      }
      setUrcat(jpeg.name);
      laSchimbare({ cale: pregatire.data.cale, nume: jpeg.name });
    });
  }

  return (
    <div className="space-y-1">
      <IncarcareFisier
        nume="poza_bon"
        id={`${id}-poza-bon`}
        eticheta="Poza bonului"
        accept="image/*"
        maxOcteti={LIMITA_FISIER_FLOTA_BYTES}
        mesajPreaMare="Fișierul depășește 20 MB."
        mesajTipRespins="Alegeți o fotografie a bonului (JPG sau PNG)."
        textAlegere="Fotografiază sau alege bonul"
        etichetaScoate="Scoate poza bonului"
        restrictii="Fotografiați doar bonul, pe o suprafață goală. Poza se micșorează înainte de urcare."
        laSchimbare={alege}
        dezactivat={inCurs}
      />
      <div aria-live="polite" className="text-nota">
        {inCurs ? <p className="text-muted-foreground">Se urcă poza bonului…</p> : null}
        {urcat === null || inCurs ? null : (
          <p className="text-muted-foreground">Poza bonului e atașată; se leagă la salvare.</p>
        )}
        {problema === null ? null : (
          <p role="alert" className="text-danger">
            {problema}
          </p>
        )}
      </div>
    </div>
  );
}
