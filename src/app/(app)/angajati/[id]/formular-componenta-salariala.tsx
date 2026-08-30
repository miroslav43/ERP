// src/app/(app)/angajati/[id]/formular-componenta-salariala.tsx
"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useState } from "react";

import { Camp } from "@/components/ui/camp";
import { IntrareData } from "@/components/ui/intrare-data";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { ActionResult } from "@/lib/actions/types";

import { asociazaComponenta } from "./componente-actions";

interface SablonOptiune {
  readonly id: string;
  readonly denumire: string;
  readonly kind: string;
}

interface Proprietati {
  readonly employeeId: string;
  readonly sabloane: readonly SablonOptiune[];
}

/**
 * Spor sau primă nouă pe fișa angajatului, într-o casetă.
 *
 * `kind`-ul componentei se DERIVĂ din șablonul ales — nu se alege liber, ca să
 * nu se poată trimite o combinație interzisă de constrângerea din bază
 * (`spor_procent` ⇒ procent obligatoriu, restul ⇒ sumă obligatorie). De aceea
 * `<select>`-ul de șablon e controlat, iar starea lui stă în componentă, nu în
 * copiii casetei: la reîntoarcere, alegerea rămâne cea de dinainte.
 *
 * Ca la celelalte formulare ale fișei, `Formular` aduce erorile pe câmp și
 * păstrează ce s-a scris la refuz — vezi `formular-contract-nou.tsx`.
 */
export function FormularComponentaSalariala({ employeeId, sabloane }: Proprietati) {
  const [sablonAlesId, setSablonAlesId] = useState(sabloane[0]?.id ?? "");

  const sablonAles = sabloane.find((s) => s.id === sablonAlesId) ?? null;
  const esteProcentual = sablonAles?.kind === "spor_procent";

  if (sabloane.length === 0) {
    return (
      <p className="text-muted-foreground text-corp">
        Niciun șablon de spor sau primă definit încă.{" "}
        <Link href="/salarizare/componente" className="text-primary underline underline-offset-2">
          Creați unul
        </Link>{" "}
        înainte de a-l putea asocia unui angajat.
      </p>
    );
  }

  /** Cheile obiectului sunt EXACT cele din `asociazaComponentaSchema`. */
  async function trimite(date: FormData) {
    if (sablonAles === null) {
      // Nu se poate ajunge aici din interfață — lista e nevidă și `<select>`-ul
      // e controlat — dar acțiunea are nevoie de un `component_type_id` real,
      // iar un `throw` ar apărea ca eroare de rețea, fără explicație.
      const refuz: ActionResult<never> = {
        ok: false,
        error: {
          code: "VALIDARE",
          message: "Alegeți un șablon.",
          fieldErrors: { component_type_id: ["Alegeți un șablon."] },
          requestId: "client",
        },
      };
      return refuz;
    }
    const procent = String(date.get("procent") ?? "");
    const suma = String(date.get("suma") ?? "");
    const valabilPana = String(date.get("valabil_pana") ?? "");
    return asociazaComponenta({
      employee_id: employeeId,
      component_type_id: sablonAles.id,
      kind: sablonAles.kind,
      procent: esteProcentual ? (procent === "" ? null : Number(procent)) : null,
      suma: esteProcentual ? null : suma === "" ? null : Number(suma),
      valabil_de_la: String(date.get("valabil_de_la") ?? ""),
      valabil_pana: valabilPana === "" ? null : valabilPana,
      observatii: String(date.get("observatii") ?? ""),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Spor sau primă nouă",
        varianta: "secundar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
        className: "mt-3",
      }}
      titlu="Spor sau primă nouă"
      descriere="Felul valorii — procent din salariul de bază sau sumă fixă — vine din șablon și nu se poate alege liber: baza refuză combinația inversă."
      marime="mare"
      actiune={trimite}
      mesajReusita="Componenta a fost adăugată."
      etichetaTrimite="Adaugă"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Camp
            nume="component_type_id"
            id={idc("component_type_id")}
            eticheta="Șablon"
            fel="select"
            obligatoriu
            className="sm:col-span-2"
            erori={stare.erori["component_type_id"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                value={sablonAlesId}
                onChange={(eveniment) => {
                  setSablonAlesId(eveniment.target.value);
                }}
              >
                {sabloane.map((sablon) => (
                  <option key={sablon.id} value={sablon.id}>
                    {sablon.denumire}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          {esteProcentual ? (
            <Camp
              nume="procent"
              id={idc("procent")}
              eticheta="Procent din salariul de bază (%)"
              obligatoriu
              erori={stare.erori["procent"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  step="0.01"
                  min={0}
                  max={300}
                  defaultValue={stare.valoriTrimise["procent"] ?? ""}
                />
              )}
            </Camp>
          ) : (
            <Camp
              nume="suma"
              id={idc("suma")}
              eticheta="Sumă fixă (lei)"
              obligatoriu
              erori={stare.erori["suma"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={stare.valoriTrimise["suma"] ?? ""}
                />
              )}
            </Camp>
          )}

          <Camp
            nume="valabil_de_la"
            id={idc("valabil_de_la")}
            eticheta="Valabil de la"
            obligatoriu
            erori={stare.erori["valabil_de_la"] ?? []}
          >
            {(a) => <IntrareData {...a} implicit={stare.valoriTrimise["valabil_de_la"] ?? ""} />}
          </Camp>

          <Camp
            nume="valabil_pana"
            id={idc("valabil_pana")}
            eticheta="Valabil până la"
            ajutor="Lăsat gol, sporul rămâne activ până e retras."
            erori={stare.erori["valabil_pana"] ?? []}
          >
            {(a) => <IntrareData {...a} implicit={stare.valoriTrimise["valabil_pana"] ?? ""} />}
          </Camp>

          <Camp
            nume="observatii"
            id={idc("observatii")}
            eticheta="Observații"
            className="sm:col-span-2"
            erori={stare.erori["observatii"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={500}
                defaultValue={stare.valoriTrimise["observatii"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
