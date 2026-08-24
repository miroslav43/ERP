// src/app/(app)/concedii/filtre-cereri.tsx
"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { STATUSURI_CERERE } from "@/schemas/leave";
import { ETICHETE_STATUS_CERERE } from "./etichete";

interface OptiuneTip {
  readonly id: string;
  readonly denumire: string;
}

interface OptiuneAngajat {
  readonly id: string;
  readonly full_name: string | null;
  readonly marca: string;
}

/**
 * Fără comutator „Ale mele / Ale echipei”: separarea stă acum în rută
 * (`/concedii` vs `/concedii/echipa`). Ca filtru, ea se pierdea la fiecare
 * apăsare pe „Aplică filtrele” — de aceea trebuia recitită din `useSearchParams`
 * și rescrisă de mână în URL-ul nou, un pas ușor de uitat la următorul filtru
 * adăugat.
 *
 * `angajati` e gol pe „Cererile mele”, unde lista are un singur angajat, și
 * plin pe „Echipa”.
 */
export function FiltreCereri({
  tipuri,
  angajati = [],
}: {
  readonly tipuri: readonly OptiuneTip[];
  readonly angajati?: readonly OptiuneAngajat[];
}) {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idStatus = useId();
  const idTip = useId();
  const idAngajat = useId();
  const idDeLa = useId();
  const idPanaLa = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const status = String(formular.get("status") ?? "");
    const leaveTypeId = String(formular.get("leave_type_id") ?? "");
    const employeeId = String(formular.get("employee_id") ?? "");
    const deLa = String(formular.get("de_la") ?? "");
    const panaLa = String(formular.get("pana_la") ?? "");
    if (status.length > 0) noi.set("status", status);
    if (leaveTypeId.length > 0) noi.set("leave_type_id", leaveTypeId);
    if (employeeId.length > 0) noi.set("employee_id", employeeId);
    if (deLa.length > 0) noi.set("de_la", deLa);
    if (panaLa.length > 0) noi.set("pana_la", panaLa);
    // `cursor` NU se copiază: aparține paginii anterioare, iar păstrat peste un
    // filtru nou ar sări rânduri.
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  return (
    <>
      <form
        action={aplica}
        role="search"
        aria-label="Filtrare cereri de concediu"
        className="border-border flex flex-wrap items-end gap-4 rounded-lg border p-4"
      >
        <div>
          <label htmlFor={idStatus} className="block text-sm font-medium">
            Stare
          </label>
          <select
            id={idStatus}
            name="status"
            defaultValue={parametri.get("status") ?? ""}
            className="border-foreground/60 mt-1 rounded-md border px-2 py-2 text-sm"
          >
            <option value="">Toate</option>
            {STATUSURI_CERERE.map((status) => (
              <option key={status} value={status}>
                {ETICHETE_STATUS_CERERE[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-48">
          <label htmlFor={idTip} className="block text-sm font-medium">
            Tip de concediu
          </label>
          <select
            id={idTip}
            name="leave_type_id"
            defaultValue={parametri.get("leave_type_id") ?? ""}
            className="border-foreground/60 mt-1 w-full rounded-md border px-2 py-2 text-sm"
          >
            <option value="">Toate</option>
            {tipuri.map((tip) => (
              <option key={tip.id} value={tip.id}>
                {tip.denumire}
              </option>
            ))}
          </select>
        </div>

        {angajati.length > 0 ? (
          <div className="min-w-56">
            <label htmlFor={idAngajat} className="block text-sm font-medium">
              Angajat
            </label>
            <select
              id={idAngajat}
              name="employee_id"
              defaultValue={parametri.get("employee_id") ?? ""}
              className="border-foreground/60 mt-1 w-full rounded-md border px-2 py-2 text-sm"
            >
              <option value="">Toți</option>
              {angajati.map((angajat) => (
                <option key={angajat.id} value={angajat.id}>
                  {angajat.full_name ?? "—"} ({angajat.marca})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor={idDeLa} className="block text-sm font-medium">
            De la
          </label>
          <input
            id={idDeLa}
            name="de_la"
            type="date"
            defaultValue={parametri.get("de_la") ?? ""}
            className="border-foreground/60 mt-1 rounded-md border px-2 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor={idPanaLa} className="block text-sm font-medium">
            Până la
          </label>
          <input
            id={idPanaLa}
            name="pana_la"
            type="date"
            defaultValue={parametri.get("pana_la") ?? ""}
            className="border-foreground/60 mt-1 rounded-md border px-2 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          <Search aria-hidden="true" className="size-4" />
          {inCurs ? "Se filtrează…" : "Aplică filtrele"}
        </button>
        <p aria-live="polite" className="sr-only">
          {inCurs ? "Se aplică filtrele." : "Filtre aplicate."}
        </p>
      </form>
    </>
  );
}
