// src/app/(app)/concedii/filtre-cereri.tsx
"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { STATUSURI_CERERE } from "@/schemas/leave";
import { ETICHETE_STATUS_CERERE } from "./etichete";

interface OptiuneTip {
  readonly id: string;
  readonly denumire: string;
}

const VIZUALIZARI: readonly { readonly cheie: string; readonly eticheta: string }[] = [
  { cheie: "toate", eticheta: "Toate" },
  { cheie: "mele", eticheta: "Ale mele" },
  { cheie: "echipa", eticheta: "Ale echipei" },
];

export function FiltreCereri({
  tipuri,
  aratăVizualizarea = false,
}: {
  readonly tipuri: readonly OptiuneTip[];
  readonly aratăVizualizarea?: boolean;
}) {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idStatus = useId();
  const idTip = useId();
  const idDeLa = useId();
  const idPanaLa = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const status = String(formular.get("status") ?? "");
    const leaveTypeId = String(formular.get("leave_type_id") ?? "");
    const deLa = String(formular.get("de_la") ?? "");
    const panaLa = String(formular.get("pana_la") ?? "");
    if (status.length > 0) noi.set("status", status);
    if (leaveTypeId.length > 0) noi.set("leave_type_id", leaveTypeId);
    if (deLa.length > 0) noi.set("de_la", deLa);
    if (panaLa.length > 0) noi.set("pana_la", panaLa);
    // Vizualizarea nu e în formular — se schimbă din butoanele de mai sus — dar
    // trebuie să supraviețuiască aplicării celorlalte filtre.
    const vizualizare = parametri.get("vizualizare");
    if (vizualizare !== null && vizualizare !== "toate") noi.set("vizualizare", vizualizare);
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  const vizualizareCurenta = parametri.get("vizualizare") ?? "toate";

  function schimbaVizualizarea(cheie: string): void {
    const noi = new URLSearchParams(parametri.toString());
    if (cheie === "toate") noi.delete("vizualizare");
    else noi.set("vizualizare", cheie);
    // Cursorul aparține paginii anterioare; păstrat, ar sări rânduri.
    noi.delete("cursor");
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  return (
    <>
      {aratăVizualizarea ? (
        <div
          role="group"
          aria-label="Ce cereri se afișează"
          className="border-border rounded-control inline-flex border p-0.5"
        >
          {VIZUALIZARI.map((v) => (
            <Buton
              key={v.cheie}
              varianta={vizualizareCurenta === v.cheie ? "primar" : "tertiar"}
              disabled={inCurs}
              aria-pressed={vizualizareCurenta === v.cheie}
              onClick={() => schimbaVizualizarea(v.cheie)}
              className="rounded"
            >
              {v.eticheta}
            </Buton>
          ))}
        </div>
      ) : null}

      <form
        action={aplica}
        role="search"
        aria-label="Filtrare cereri de concediu"
        className="border-border rounded-panou flex flex-wrap items-end gap-4 border p-4"
      >
        <div>
          <label htmlFor={idStatus} className="text-corp block font-medium">
            Stare
          </label>
          <select
            id={idStatus}
            name="status"
            defaultValue={parametri.get("status") ?? ""}
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

        <div className="min-w-48">
          <label htmlFor={idTip} className="text-corp block font-medium">
            Tip de concediu
          </label>
          <select
            id={idTip}
            name="leave_type_id"
            defaultValue={parametri.get("leave_type_id") ?? ""}
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
          <label htmlFor={idDeLa} className="text-corp block font-medium">
            De la
          </label>
          <input
            id={idDeLa}
            name="de_la"
            type="date"
            defaultValue={parametri.get("de_la") ?? ""}
            className="border-foreground/60 rounded-control text-corp mt-1 border px-2 py-2"
          />
        </div>

        <div>
          <label htmlFor={idPanaLa} className="text-corp block font-medium">
            Până la
          </label>
          <input
            id={idPanaLa}
            name="pana_la"
            type="date"
            defaultValue={parametri.get("pana_la") ?? ""}
            className="border-foreground/60 rounded-control text-corp mt-1 border px-2 py-2"
          />
        </div>

        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se filtrează…">
          <Search aria-hidden="true" className="size-4" />
          Aplică filtrele
        </Buton>
        <p aria-live="polite" className="sr-only">
          {inCurs ? "Se aplică filtrele." : "Filtre aplicate."}
        </p>
      </form>
    </>
  );
}
