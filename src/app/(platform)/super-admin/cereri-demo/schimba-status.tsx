// src/app/(platform)/super-admin/cereri-demo/schimba-status.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { schimbaStatusCerere } from "./actions";
import { ETICHETE_STATUS, STATUSURI_CERERE, type StatusCerere } from "./constante";

type Rezultat = Readonly<{ tip: "inactiv" } | { tip: "ok" } | { tip: "eroare"; mesaj: string }>;

export function SchimbaStatus({
  cerereId,
  statusCurent,
}: {
  cerereId: string;
  statusCurent: StatusCerere;
}) {
  const idCamp = useId();
  const router = useRouter();
  const [selectat, setSelectat] = useState<StatusCerere>(statusCurent);
  const [rezultat, setRezultat] = useState<Rezultat>({ tip: "inactiv" });
  const [inCurs, startTransition] = useTransition();

  const salveaza = () => {
    setRezultat({ tip: "inactiv" });
    startTransition(async () => {
      const raspuns = await schimbaStatusCerere({ id: cerereId, status: selectat });
      if (raspuns.ok) {
        setRezultat({ tip: "ok" });
        router.refresh();
        return;
      }
      setRezultat({ tip: "eroare", mesaj: raspuns.error.message });
    });
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor={`${idCamp}-status`} className="block text-sm font-medium">
          Status
        </label>
        <select
          id={`${idCamp}-status`}
          value={selectat}
          disabled={inCurs}
          onChange={(eveniment) => setSelectat(eveniment.target.value as StatusCerere)}
          className="border-border bg-background mt-1.5 rounded-md border px-3 py-2 text-sm"
        >
          {STATUSURI_CERERE.map((status) => (
            <option key={status} value={status}>
              {ETICHETE_STATUS[status]}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={salveaza}
        disabled={inCurs || selectat === statusCurent}
        className="border-border hover:border-primary inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
      >
        {inCurs ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {inCurs ? "Se salvează…" : "Salvează statusul"}
      </button>

      <p aria-live="polite" className="text-sm">
        {rezultat.tip === "ok" ? <span className="text-success">Status actualizat.</span> : null}
        {rezultat.tip === "eroare" ? <span className="text-danger">{rezultat.mesaj}</span> : null}
      </p>
    </div>
  );
}
