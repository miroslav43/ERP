"use client";

// src/app/(app)/evaluari/kpi/seturi/actiuni-set.tsx

/**
 * Editarea și arhivarea unui set.
 *
 * Rezultatul se CITEȘTE, nu se ignoră: un UPDATE respins de clauza `USING`
 * atinge zero rânduri și nu ridică eroare, deci un `await …; router.refresh()`
 * fără verificare arată exact ca o reușită.
 */

import { Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";
import type { SetKpi } from "@/lib/queries/kpi";

import { arhiveazaSetKpi } from "../actions";

import { ConstructorSet } from "./constructor-set";

export function ActiuniSet({
  set,
  functiiSugerate,
}: Readonly<{ set: SetKpi; functiiSugerate: readonly string[] }>): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deConfirmat, setDeConfirmat] = useState(false);

  const arhiveaza = () => {
    porneste(async () => {
      const date = new FormData();
      date.set("id", set.id);
      const rezultat = await arhiveazaSetKpi(date);
      setDeConfirmat(false);
      if (rezultat.ok) {
        arataToast({ fel: "reusita", text: "Setul a fost arhivat." });
        router.refresh();
        return;
      }
      arataToast({ fel: "eroare", text: rezultat.error.message });
    });
  };

  return (
    <>
      <BaraActiuni eticheta={`Acțiuni pentru setul ${set.denumire}`}>
        <ConstructorSet
          set={set}
          functiiSugerate={functiiSugerate}
          declansator={{ eticheta: "Editează", varianta: "secundar" }}
        />
        {set.activ ? (
          <Buton
            marime="iconita"
            aria-label={`Arhivează setul ${set.denumire}`}
            inCurs={inCurs}
            onClick={() => {
              setDeConfirmat(true);
            }}
          >
            <Archive className="size-4" />
          </Buton>
        ) : null}
      </BaraActiuni>

      <ConfirmareActiune
        deschis={deConfirmat}
        laInchidere={() => {
          setDeConfirmat(false);
        }}
        titlu={`Arhivezi „${set.denumire}”?`}
        consecinta="Funcția rămâne fără set activ, deci nu se mai pot deschide luni noi pentru angajații ei. Lunile deja deschise nu se ating."
        etichetaConfirmare="Arhivează"
        laConfirmare={arhiveaza}
        inCurs={inCurs}
      />
    </>
  );
}
