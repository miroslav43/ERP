// src/app/(app)/concedii/[id]/actiuni-cerere.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Send } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";

import { anuleazaCerere, trimiteCerere } from "../actions";

/**
 * Ce se poate face cu o cerere de pe fișa ei.
 *
 * ── CE REPARĂ ─────────────────────────────────────────────────────────────
 * Ecranul oferea, pe o CIORNĂ, exact un buton: „Anulează cererea”. Ciorna se
 * putea crea din formular și nu se putea trimite din nicio parte a produsului —
 * modulul avea trei acțiuni și niciuna nu ridica o ciornă la „trimisă”. Cine
 * apăsa „Salvează ca ciornă” își pierdea munca sau o refăcea de la zero.
 * Butonul primar de aici e capătul lipsă al acelui drum.
 *
 * Anularea a primit confirmare în doi pași în același timp, și nu ca zel: e o
 * stare TERMINALĂ (`anulata` nu mai are ieșire în nicio politică), stă acum
 * lângă un buton primar nou, iar tiparul exista deja în modul, la
 * `setari/buton-aplica-drepturi.tsx`. Consecința se scrie în text, nu se
 * subînțelege.
 */
export function ActiuniCerere({
  cerereId,
  esteCiorna = false,
}: {
  readonly cerereId: string;
  /** Numai o ciornă se poate trimite; restul stărilor n-au buton de trimitere. */
  readonly esteCiorna?: boolean;
}) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [confirmareCeruta, setConfirmareCeruta] = useState(false);
  const [inCurs, porneste] = useTransition();

  function trimite(): void {
    setEroare(null);
    setConfirmareCeruta(false);
    porneste(async () => {
      const rezultat = await trimiteCerere({ id: cerereId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  function anuleaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await anuleazaCerere({ id: cerereId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setConfirmareCeruta(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {esteCiorna ? (
          <Buton
            varianta="primar"
            inCurs={inCurs}
            textInCurs="Se trimite…"
            onClick={trimite}
            disabled={confirmareCeruta}
          >
            <Send aria-hidden="true" className="size-4" />
            Trimite spre aprobare
          </Buton>
        ) : null}

        {confirmareCeruta ? null : (
          <Buton
            varianta="distructiv"
            inCurs={inCurs}
            textInCurs="Se anulează…"
            onClick={() => {
              setEroare(null);
              setConfirmareCeruta(true);
            }}
          >
            <Ban aria-hidden="true" className="size-4" />
            Anulează cererea
          </Buton>
        )}
      </div>

      {confirmareCeruta ? (
        <Callout
          fel="atentie"
          titlu="Anulați cererea?"
          actiune={
            <div className="flex flex-wrap gap-2">
              <Buton
                varianta="distructiv"
                inCurs={inCurs}
                textInCurs="Se anulează…"
                onClick={anuleaza}
              >
                Da, anulează
              </Buton>
              <Buton
                varianta="tertiar"
                disabled={inCurs}
                onClick={() => {
                  setConfirmareCeruta(false);
                }}
              >
                Renunț
              </Buton>
            </div>
          }
        >
          Anularea e definitivă: cererea nu mai poate fi trimisă după aceea, iar zilele ei se întorc
          în sold. Pentru aceeași perioadă va trebui depusă o cerere nouă.
        </Callout>
      ) : null}

      {/* Randat DOAR când există. Paragraful de dinainte stătea în pagină
          necondiționat și rezerva o linie liberă sub buton la fiecare
          încărcare a fișei. `Callout fel="eroare"` își pune singur
          `role="alert"`, deci mesajul se anunță la apariție. */}
      {eroare === null ? null : <Callout fel="eroare">{eroare}</Callout>}
    </div>
  );
}
