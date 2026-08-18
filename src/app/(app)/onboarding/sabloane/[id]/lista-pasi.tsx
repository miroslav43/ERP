"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";

import { mutaPas, stergePas } from "../../actions";
import { ETICHETE_RESPONSABIL_TIP, ETICHETE_ROL, ETICHETE_TIP_DOVADA } from "../../etichete";
import { FormularPas } from "./formular-pas";

export interface PasSablonAfisat {
  readonly id: string;
  readonly ordine: number;
  readonly titlu: string;
  readonly descriere: string | null;
  readonly responsabil_tip: "rol" | "angajat" | "manager_direct";
  readonly responsabil_rol:
    | "super_admin"
    | "org_admin"
    | "manager"
    | "hr"
    | "employee"
    | null;
  readonly responsabil_employee_id: string | null;
  readonly termen_zile_relativ: number;
  readonly obligatoriu: boolean;
  readonly tip_dovada: "niciuna" | "bifa" | "document" | "semnatura";
  readonly verificare_automata: "inventar_returnat" | "acces_revocat" | "documente_semnate" | null;
}

interface Proprietati {
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

export function ListaPasi({ templateId, pasi, poateEditare, poateAdauga }: Proprietati) {
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
      setAnunt(`Pasul „${pas.titlu}” este acum poziția ${String(pozitieNoua)} din ${String(pasi.length)}.`);
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
          className="rounded-lg border border-danger/40 bg-danger/8 p-3 text-sm text-danger"
        >
          {eroare}
        </p>
      )}

      {pasi.length === 0 ? (
        <p className="text-sm text-muted-foreground">Acest șablon nu are încă niciun pas.</p>
      ) : (
        <ol className="space-y-2">
          {pasi.map((pas, index) =>
            idInEditare === pas.id ? (
              <li key={pas.id}>
                <FormularPas
                  templateId={templateId}
                  initial={pas}
                  onGata={() => {
                    setIdInEditare(null);
                  }}
                />
              </li>
            ) : (
              <li key={pas.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {pas.ordine}. {pas.titlu}
                      {pas.obligatoriu ? (
                        <span className="ml-1 text-xs text-muted-foreground">(obligatoriu)</span>
                      ) : null}
                    </p>
                    {pas.descriere === null ? null : (
                      <p className="mt-0.5 text-sm text-muted-foreground">{pas.descriere}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Responsabil: {responsabilText(pas)} · Dovadă: {ETICHETE_TIP_DOVADA[pas.tip_dovada]} ·
                      Termen: {pas.termen_zile_relativ} zile
                      {pas.verificare_automata === null ? "" : ` · Verificare automată: ${pas.verificare_automata}`}
                    </p>
                  </div>

                  {poateEditare ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Mută pasul „${pas.titlu}” mai sus`}
                        disabled={inCurs || index === 0}
                        onClick={() => {
                          muta(pas, "sus", index);
                        }}
                        className="rounded-md border border-foreground/60 p-1.5 hover:bg-surface disabled:opacity-40"
                      >
                        <ArrowUp aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Mută pasul „${pas.titlu}” mai jos`}
                        disabled={inCurs || index === pasi.length - 1}
                        onClick={() => {
                          muta(pas, "jos", index);
                        }}
                        className="rounded-md border border-foreground/60 p-1.5 hover:bg-surface disabled:opacity-40"
                      >
                        <ArrowDown aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Editează pasul „${pas.titlu}”`}
                        disabled={inCurs}
                        onClick={() => {
                          setIdInEditare(pas.id);
                        }}
                        className="rounded-md border border-foreground/60 p-1.5 hover:bg-surface disabled:opacity-40"
                      >
                        <Pencil aria-hidden="true" className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Șterge pasul „${pas.titlu}”`}
                        disabled={inCurs}
                        onClick={() => {
                          sterge(pas);
                        }}
                        className="rounded-md border border-danger p-1.5 text-danger hover:bg-danger hover:text-danger-foreground disabled:opacity-40"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ),
          )}
        </ol>
      )}

      {poateAdauga ? <FormularPas templateId={templateId} /> : null}
    </div>
  );
}
