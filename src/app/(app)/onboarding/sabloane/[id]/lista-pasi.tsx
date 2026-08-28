"use client";

import type { ChecklistVerificare, ChecklistResponsabilTip } from "@/schemas/checklist";

import type { OptiuneCurs } from "./formular-pas";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";

import { Buton } from "@/components/ui/buton";

import { mutaPas, stergePas } from "../../actions";
import { ETICHETE_RESPONSABIL_TIP, ETICHETE_ROL, ETICHETE_TIP_DOVADA } from "../../etichete";
import { FormularPas } from "./formular-pas";

export interface PasSablonAfisat {
  readonly id: string;
  readonly ordine: number;
  readonly titlu: string;
  readonly descriere: string | null;
  // Legat de sursă, nu scris de mână: uniunea de aici a rămas în urmă la 0089,
  // care a adăugat `subiect`. Aceeași capcană ca la `verificare_automata`.
  readonly responsabil_tip: ChecklistResponsabilTip;
  readonly responsabil_rol: "super_admin" | "org_admin" | "manager" | "hr" | "employee" | null;
  readonly responsabil_employee_id: string | null;
  readonly termen_zile_relativ: number;
  readonly obligatoriu: boolean;
  readonly tip_dovada: "niciuna" | "bifa" | "document" | "semnatura";
  // Legat de sursă: uniunea scrisă de mână a rămas în urmă la 0076.
  readonly verificare_automata: ChecklistVerificare | null;
  readonly curs_id: string | null;
}

interface Proprietati {
  readonly cursuri: readonly OptiuneCurs[];
  readonly templateId: string;
  readonly pasi: readonly PasSablonAfisat[];
  readonly poateEditare: boolean;
  readonly poateAdauga: boolean;
}

function responsabilText(pas: PasSablonAfisat): string {
  if (pas.responsabil_tip === "manager_direct") return ETICHETE_RESPONSABIL_TIP.manager_direct;
  if (pas.responsabil_tip === "rol" && pas.responsabil_rol !== null) {
    return `${ETICHETE_RESPONSABIL_TIP.rol}: ${ETICHETE_ROL[pas.responsabil_rol]}`;
  }
  if (pas.responsabil_tip === "angajat") return ETICHETE_RESPONSABIL_TIP.angajat;
  return ETICHETE_RESPONSABIL_TIP[pas.responsabil_tip];
}

export function ListaPasi({ templateId, cursuri, pasi, poateEditare, poateAdauga }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [anunt, setAnunt] = useState("");
  const [idInEditare, setIdInEditare] = useState<string | null>(null);

  function muta(pas: PasSablonAfisat, directie: "sus" | "jos", pozitie: number): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await mutaPas({ id: pas.id, directie });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      const pozitieNoua = directie === "sus" ? pozitie : pozitie + 2;
      setAnunt(
        `Pasul „${pas.titlu}” este acum poziția ${String(pozitieNoua)} din ${String(pasi.length)}.`,
      );
      router.refresh();
    });
  }

  function sterge(pas: PasSablonAfisat): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await stergePas({ id: pas.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div aria-live="polite" className="sr-only">
        {anunt}
      </div>

      {eroare === null ? null : (
        <p
          role="alert"
          className="border-danger/40 bg-danger/8 text-danger rounded-panou text-corp border p-3"
        >
          {eroare}
        </p>
      )}

      {pasi.length === 0 ? (
        <p className="text-muted-foreground text-corp">Acest șablon nu are încă niciun pas.</p>
      ) : (
        <ol className="space-y-2">
          {pasi.map((pas, index) =>
            idInEditare === pas.id ? (
              <li key={pas.id}>
                <FormularPas
                  templateId={templateId}
                  cursuri={cursuri}
                  initial={pas}
                  onGata={() => {
                    setIdInEditare(null);
                  }}
                />
              </li>
            ) : (
              <li key={pas.id} className="border-border rounded-panou border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {pas.ordine}. {pas.titlu}
                      {pas.obligatoriu ? (
                        <span className="text-muted-foreground text-nota ml-1">(obligatoriu)</span>
                      ) : null}
                    </p>
                    {pas.descriere === null ? null : (
                      <p className="text-muted-foreground text-corp mt-0.5">{pas.descriere}</p>
                    )}
                    <p className="text-muted-foreground text-nota mt-1">
                      Responsabil: {responsabilText(pas)} · Dovadă:{" "}
                      {ETICHETE_TIP_DOVADA[pas.tip_dovada]} · Termen: {pas.termen_zile_relativ} zile
                      {pas.verificare_automata === null
                        ? ""
                        : ` · Verificare automată: ${pas.verificare_automata}`}
                    </p>
                  </div>

                  {poateEditare ? (
                    <div className="flex items-center gap-1">
                      <Buton
                        varianta="secundar"
                        marime="iconita"
                        aria-label={`Mută pasul „${pas.titlu}” mai sus`}
                        disabled={inCurs || index === 0}
                        onClick={() => {
                          muta(pas, "sus", index);
                        }}
                      >
                        <ArrowUp aria-hidden="true" className="size-4" />
                      </Buton>
                      <Buton
                        varianta="secundar"
                        marime="iconita"
                        aria-label={`Mută pasul „${pas.titlu}” mai jos`}
                        disabled={inCurs || index === pasi.length - 1}
                        onClick={() => {
                          muta(pas, "jos", index);
                        }}
                      >
                        <ArrowDown aria-hidden="true" className="size-4" />
                      </Buton>
                      <Buton
                        varianta="secundar"
                        marime="iconita"
                        aria-label={`Editează pasul „${pas.titlu}”`}
                        disabled={inCurs}
                        onClick={() => {
                          setIdInEditare(pas.id);
                        }}
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </Buton>
                      <Buton
                        varianta="distructiv"
                        marime="iconita"
                        aria-label={`Șterge pasul „${pas.titlu}”`}
                        disabled={inCurs}
                        onClick={() => {
                          sterge(pas);
                        }}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Buton>
                    </div>
                  ) : null}
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      {poateAdauga ? <FormularPas templateId={templateId} cursuri={cursuri} /> : null}
    </div>
  );
}
