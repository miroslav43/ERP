"use client";

// src/app/(app)/cursuri/[id]/editare/stare-curs.tsx
//
// ── DE CE E O SECȚIUNE SEPARATĂ, NU UN CÂMP ÎN FORMULAR ─────────────────────
// „Dezactivat" nu e o proprietate a cursului de același fel cu denumirea sau
// termenul: nu se salvează cu restul, are consecință imediată și e singurul
// lucru de aici care schimbă ce se poate face MÂINE. Ca bifă în formular ar fi
// putut fi comutată din greșeală odată cu o corectură de titlu.
//
// ── DE CE FĂRĂ CONFIRMARE ───────────────────────────────────────────────────
// Se desface dintr-un clic și nu atinge nicio înrolare pornită — exact
// raționamentul din `puncte-lucru/actiuni-punct-lucru.tsx:22-26`. Un dialog
// aici ar fi ceremonie peste un gest reversibil.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Undo2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Buton } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";

import { dezactiveazaCurs } from "../../actions";

interface Proprietati {
  readonly cursId: string;
  readonly denumire: string;
  readonly activ: boolean;
}

export function StareCurs({ cursId, denumire, activ }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  function comuta(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await dezactiveazaCurs({ id: cursId, activ: !activ });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      arataToast({
        fel: "reusita",
        text: activ ? "Cursul a fost dezactivat." : "Cursul a fost reactivat.",
      });
      router.refresh();
    });
  }

  return (
    <section
      aria-labelledby="titlu-stare-curs"
      className="border-border bg-background rounded-panou shadow-ridicat border p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="titlu-stare-curs" className="text-sectiune font-medium">
          Starea cursului
        </h2>
        {activ ? <Badge ton="succes">Activ</Badge> : <Badge ton="neutru">Dezactivat</Badge>}
      </div>

      {/*
        Consecința EXACTĂ, luată din trigger (`0085:63`), nu o formulă generală:
        dezactivarea oprește atribuirile noi — manuale și prin regulă — și NU
        atinge nimic din ce e deja pornit.
      */}
      <p className="text-muted-foreground text-corp mt-2">
        {activ
          ? "Un curs dezactivat nu se mai poate atribui nimănui, nici manual, nici prin reguli. Înrolările deja pornite rămân neatinse, iar cine e la jumătate poate continua."
          : "Cursul nu se mai poate atribui. Reactivați-l ca să intre din nou în atribuiri și în reguli."}
      </p>

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota mt-2">
          {eroare}
        </p>
      )}

      <div className="mt-3">
        {activ ? (
          <Buton
            varianta="distructiv"
            onClick={comuta}
            disabled={inCurs}
            aria-label={`Dezactivează cursul „${denumire}”`}
          >
            <Ban aria-hidden="true" className="size-4" />
            Dezactivează cursul
          </Buton>
        ) : (
          <Buton
            varianta="secundar"
            onClick={comuta}
            disabled={inCurs}
            aria-label={`Reactivează cursul „${denumire}”`}
          >
            <Undo2 aria-hidden="true" className="size-4" />
            Reactivează cursul
          </Buton>
        )}
      </div>
    </section>
  );
}
