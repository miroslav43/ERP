// src/app/(app)/concedii/filtre-cereri.tsx
import type { ReactElement } from "react";
import Link from "next/link";

import { BaraFiltre, type FiltruActiv } from "@/components/ui/bara-filtre";
import { buton } from "@/components/ui/buton";
import { Combobox } from "@/components/ui/combobox";
import { formatDate } from "@/lib/format/date";
import { cn } from "@/lib/ui/cn";
import {
  STATUSURI_CERERE,
  type StatusCerere,
  type FiltreCereri as ValoriFiltre,
} from "@/schemas/leave";
import { ETICHETE_STATUS_CERERE } from "./etichete";

/**
 * Filtrele listei de cereri de concediu.
 *
 * ── CE REPARĂ MIGRAREA ────────────────────────────────────────────────────
 * Vechiul `aplica()` pornea dintr-un `new URLSearchParams()` GOL și repopula
 * doar cele patru chei ale formularului. Un singur parametru era salvat
 * explicit — `vizualizare`, cu un comentariu care explica de ce — dovada că
 * autorul văzuse problema și o rezolvase pentru un singur caz. Verificat pe
 * `status=trimisa&vizualizare=echipa&sort=-perioada&limita=50&employee_id=…`,
 * o apăsare pe „Aplică filtrele” lăsa `status=trimisa&vizualizare=echipa`:
 * sortarea, mărimea paginii și angajatul ales dispăreau tăcut.
 *
 * `<BaraFiltre>` pornește acum ÎNTOTDEAUNA din adresa curentă și atinge numai
 * `CHEI_PROPRII`. Fișierul nu mai are stare și niciun handler — comutatorul de
 * vizualizare a devenit trei `<Link replace>` — deci nu mai e `"use client"`.
 */

interface OptiuneTip {
  readonly id: string;
  readonly denumire: string;
}

export interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

const VIZUALIZARI: readonly { readonly cheie: string; readonly eticheta: string }[] = [
  { cheie: "toate", eticheta: "Toate" },
  { cheie: "mele", eticheta: "Ale mele" },
  { cheie: "echipa", eticheta: "Ale echipei" },
];

/**
 * Cheile administrate de bară — exact cele pe care le scria vechiul `aplica()`.
 * `vizualizare` NU e printre ele: nu e câmp de formular, ci comutatorul de
 * deasupra, iar „Șterge toate filtrele” n-are de ce să-l reseteze. Supraviețuiește
 * oricum, fiindcă bara pornește din adresa curentă.
 */
const CHEI_PROPRII = ["status", "leave_type_id", "de_la", "pana_la", "employee_id"] as const;

// Fără `useId`: componenta e un Server Component și apare o singură dată pe pagină.
const ID_STATUS = "filtre-cereri-status";
const ID_TIP = "filtre-cereri-tip";
const ID_DE_LA = "filtre-cereri-de-la";
const ID_PANA_LA = "filtre-cereri-pana-la";
const ID_ANGAJAT = "filtre-cereri-angajat";

type Parametri = Record<string, string | string[] | undefined>;

function esteStatus(valoare: string): valoare is StatusCerere {
  return (STATUSURI_CERERE as readonly string[]).includes(valoare);
}

/**
 * Ziua în convenția românească — dar o pastilă nu are voie să dărâme pagina.
 * `formatDate` aruncă și pe `2026-02-30`, care trece de orice verificare de
 * format; o adresă editată de mână își arată atunci valoarea brută.
 */
function ziCitibila(valoare: string): string {
  try {
    return formatDate(valoare);
  } catch {
    return valoare;
  }
}

/**
 * Pastilele — filtrele CURENTE, cu etichete citibile. Pentru `leave_type_id`
 * eticheta e DENUMIREA tipului, luată din opțiunile pe care componenta le
 * primește oricum: o pastilă care scrie un UUID nu ajută pe nimeni.
 */
function filtreActive(
  filtre: ValoriFiltre,
  tipuri: readonly OptiuneTip[],
  angajati: readonly OptiuneAngajat[],
): readonly FiltruActiv[] {
  const active: FiltruActiv[] = [];

  if (filtre.employee_id !== null) {
    const angajat = angajati.find((a) => a.id === filtre.employee_id);
    active.push({
      cheie: "employee_id",
      eticheta:
        angajat === undefined ? "Angajat ales" : `Angajat: ${angajat.full_name} (${angajat.marca})`,
    });
  }

  if (filtre.status !== null) {
    const citibile = filtre.status.map((bucata) =>
      esteStatus(bucata) ? ETICHETE_STATUS_CERERE[bucata] : bucata,
    );
    if (citibile.length > 0) {
      active.push({ cheie: "status", eticheta: `Stare: ${citibile.join(", ")}` });
    }
  }

  if (filtre.leave_type_id !== null) {
    const tip = tipuri.find((t) => t.id === filtre.leave_type_id);
    // Un tip care nu mai e în listă (dezactivat, șters) rămâne filtrabil, dar
    // fără denumire nu-l putem numi — atunci pastila spune doar ce filtru e.
    active.push({
      cheie: "leave_type_id",
      eticheta: tip === undefined ? "Tip de concediu ales" : `Tip de concediu: ${tip.denumire}`,
    });
  }

  if (filtre.de_la !== null) {
    active.push({ cheie: "de_la", eticheta: `De la: ${ziCitibila(filtre.de_la)}` });
  }
  if (filtre.pana_la !== null) {
    active.push({ cheie: "pana_la", eticheta: `Până la: ${ziCitibila(filtre.pana_la)}` });
  }

  return active;
}

/**
 * Adresa unui buton de vizualizare. Pornește din parametrii EXISTENȚI — altfel
 * comutatorul ar arunca filtrele, exact defectul reparat mai sus — și lasă în
 * urmă cursorul, care aparține paginii anterioare.
 */
function adresaVizualizare(parametri: Parametri, cheie: string): string {
  const p = new URLSearchParams();
  for (const [numeCheie, valoare] of Object.entries(parametri)) {
    if (typeof valoare === "string" && valoare !== "") p.set(numeCheie, valoare);
  }
  if (cheie === "toate") p.delete("vizualizare");
  else p.set("vizualizare", cheie);
  p.delete("cursor");
  return p.size === 0 ? "/concedii" : `/concedii?${p.toString()}`;
}

export function FiltreCereri({
  tipuri,
  angajati,
  filtre,
  parametri,
  aratăVizualizarea = false,
}: {
  readonly tipuri: readonly OptiuneTip[];
  /**
   * Angajații filtrabili. Lista goală pentru scope „own”: acolo RLS restrânge
   * oricum rezultatul la o singură fișă, iar un filtru cu un singur element ar
   * sugera că mai există și altceva de văzut.
   */
  readonly angajati: readonly OptiuneAngajat[];
  /** Filtrele deja trecute prin `filtreDinUrl` — exact ce a folosit lista. */
  readonly filtre: ValoriFiltre;
  /**
   * Parametrii BRUȚI, folosiți EXCLUSIV de `adresaVizualizare`.
   *
   * Comutatorul de vizualizare trebuie să păstreze TOATE cheile din adresă,
   * inclusiv pe cele pe care schema nu le cunoaște; `filtre` le-a pierdut deja
   * prin validare. Pastilele și valorile din câmpuri NU se iau de aici — vezi
   * nota de sus despre cele două surse care nu spuneau același lucru.
   */
  readonly parametri: Parametri;
  readonly aratăVizualizarea?: boolean;
}): ReactElement {
  const vizualizareCurenta = filtre.vizualizare;

  return (
    <>
      {aratăVizualizarea ? (
        <div
          role="group"
          aria-label="Ce cereri se afișează"
          className="border-border rounded-control inline-flex border p-0.5"
        >
          {VIZUALIZARI.map((v) => {
            const curenta = vizualizareCurenta === v.cheie;
            return (
              <Link
                key={v.cheie}
                href={adresaVizualizare(parametri, v.cheie)}
                replace
                aria-current={curenta ? "true" : undefined}
                // `rounded` peste `rounded-control`: colțurile mici ale unui
                // segment din grup, ca la butoanele pe care le înlocuiesc.
                className={cn(buton({ varianta: curenta ? "primar" : "tertiar" }), "rounded")}
              >
                {v.eticheta}
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* Reperul de căutare stă pe înveliș: `<BaraFiltre>` își randează singură
          formularul, iar pastilele fac parte din aceeași treabă. */}
      <div role="search" aria-label="Filtrare cereri de concediu">
        <BaraFiltre
          active={filtreActive(filtre, tipuri, angajati)}
          cheiProprii={[...CHEI_PROPRII]}
          textAplica="Aplică filtrele"
        >
          <div>
            <label htmlFor={ID_STATUS} className="text-corp block font-medium">
              Stare
            </label>
            <select
              // `key` legat de valoarea din adresă: un control NECONTROLAT își ia
              // `defaultValue` doar la montare, deci după „Șterge filtrul” ar fi
              // rămas cu valoarea veche în câmp — și ar fi reaplicat-o la
              // următoarea apăsare pe „Aplică filtrele”.
              key={filtre.status?.join(",") ?? ""}
              id={ID_STATUS}
              name="status"
              defaultValue={filtre.status?.join(",") ?? ""}
              className="border-foreground/60 rounded-control text-corp mt-1 border px-2 py-2"
            >
              <option value="">Toate</option>
              {STATUSURI_CERERE.map((status) => (
                <option key={status} value={status}>
                  {ETICHETE_STATUS_CERERE[status]}
                </option>
              ))}
            </select>
          </div>

          {/*
            Filtrul după angajat era plătit de tot stratul de date și n-avea
            niciun control: `schemas/leave.ts` îl declară (`employee_id`),
            `queries/leave.ts` îl aplică (`.eq("employee_id", …)` peste scope
            „own”), iar interfața nu-l scria nicăieri. Un HR cu 200 de fișe nu
            putea izola cererile unei persoane.

            Combobox, nu `<select>`: se caută și după marcă, iar `secundar` o
            face căutabilă fără s-o îngrămădească în etichetă.
          */}
          {angajati.length === 0 ? null : (
            <div className="min-w-56">
              <label htmlFor={ID_ANGAJAT} className="text-corp block font-medium">
                Angajat
              </label>
              <Combobox
                // `key` legat de valoarea din adresă, ca la celelalte câmpuri:
                // un control necontrolat își ia alegerea inițială o singură
                // dată, deci după „Șterge filtrul” ar fi rămas cu cea veche și
                // ar fi reaplicat-o la următoarea trimitere.
                key={filtre.employee_id ?? ""}
                id={ID_ANGAJAT}
                name="employee_id"
                className="mt-1"
                valoareInitiala={filtre.employee_id ?? ""}
                placeholder="Toți angajații"
                textFaraRezultate="Niciun angajat cu numele sau marca aceasta."
                optiuni={[
                  { valoare: "", eticheta: "Toți angajații" },
                  ...angajati.map((angajat) => ({
                    valoare: angajat.id,
                    eticheta: angajat.full_name,
                    secundar: angajat.marca,
                  })),
                ]}
              />
            </div>
          )}

          <div className="min-w-48">
            <label htmlFor={ID_TIP} className="text-corp block font-medium">
              Tip de concediu
            </label>
            <select
              key={filtre.leave_type_id ?? ""}
              id={ID_TIP}
              name="leave_type_id"
              defaultValue={filtre.leave_type_id ?? ""}
              className="border-foreground/60 rounded-control text-corp mt-1 w-full border px-2 py-2"
            >
              <option value="">Toate</option>
              {tipuri.map((tip) => (
                <option key={tip.id} value={tip.id}>
                  {tip.denumire}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={ID_DE_LA} className="text-corp block font-medium">
              De la
            </label>
            <input
              key={filtre.de_la ?? ""}
              id={ID_DE_LA}
              name="de_la"
              type="date"
              defaultValue={filtre.de_la ?? ""}
              className="border-foreground/60 rounded-control text-corp mt-1 border px-2 py-2"
            />
          </div>

          <div>
            <label htmlFor={ID_PANA_LA} className="text-corp block font-medium">
              Până la
            </label>
            <input
              key={filtre.pana_la ?? ""}
              id={ID_PANA_LA}
              name="pana_la"
              type="date"
              defaultValue={filtre.pana_la ?? ""}
              className="border-foreground/60 rounded-control text-corp mt-1 border px-2 py-2"
            />
          </div>
        </BaraFiltre>
      </div>
    </>
  );
}
