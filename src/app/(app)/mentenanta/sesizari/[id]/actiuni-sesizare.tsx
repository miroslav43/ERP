"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Wrench, X } from "lucide-react";

import { REZULTATE_INTERVENTIE } from "@/schemas/maintenance";
import { ETICHETE_REZULTAT_INTERVENTIE } from "../../etichete";
import { rezolvaSesizare, trieazaSesizare } from "../../actions";

const LUNGIME_MINIMA_MOTIV = 5;

export function ActiuniSesizare({ sesizareId }: { readonly sesizareId: string }) {
  const router = useRouter();
  const [panou, setPanou] = useState<"inchis" | "respingere" | "rezolvare">("inchis");
  const [motivRespingere, setMotivRespingere] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();
  const idMotiv = useId();
  const idData = useId();
  const idDescriere = useId();
  const idCostPiese = useId();
  const idCostManopera = useId();
  const idRezultat = useId();

  function triaza(status: "in_analiza" | "in_lucru" | "respins"): void {
    if (status === "respins" && motivRespingere.trim().length < LUNGIME_MINIMA_MOTIV) {
      setEroare(
        `Motivul respingerii trebuie să aibă cel puțin ${String(LUNGIME_MINIMA_MOTIV)} caractere.`,
      );
      return;
    }
    setEroare(null);
    porneste(async () => {
      const rezultat = await trieazaSesizare({
        id: sesizareId,
        status,
        motiv_respingere: status === "respins" ? motivRespingere : null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setPanou("inchis");
      router.refresh();
    });
  }

  function rezolva(formular: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await rezolvaSesizare({
        id: sesizareId,
        tip: "corectiva",
        data: String(formular.get("data") ?? ""),
        ora_start: null,
        durata_ore: null,
        executant_employee_id: null,
        executant_extern: null,
        descriere: String(formular.get("descriere") ?? ""),
        piese: null,
        cost_piese: Number(formular.get("cost_piese") ?? "0"),
        cost_manopera: Number(formular.get("cost_manopera") ?? "0"),
        rezultat: String(formular.get("rezultat") ?? "reusita"),
        oprire_minute: null,
        citire_contor: null,
        observatii: null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setPanou("inchis");
      router.refresh();
    });
  }

  if (panou === "rezolvare") {
    return (
      <form
        action={rezolva}
        className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2"
      >
        <p className="text-sm font-medium sm:col-span-2">
          Rezolvarea creează intervenția care a rezolvat defecțiunea.
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor={idData} className="text-sm">
            Data intervenției
          </label>
          <input
            id={idData}
            name="data"
            type="date"
            required
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idRezultat} className="text-sm">
            Rezultat
          </label>
          <select
            id={idRezultat}
            name="rezultat"
            defaultValue="reusita"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          >
            {REZULTATE_INTERVENTIE.map((r) => (
              <option key={r} value={r}>
                {ETICHETE_REZULTAT_INTERVENTIE[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={idDescriere} className="text-sm">
            Ce s-a făcut
          </label>
          <textarea
            id={idDescriere}
            name="descriere"
            rows={3}
            required
            minLength={3}
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCostPiese} className="text-sm">
            Cost piese (lei)
          </label>
          <input
            id={idCostPiese}
            name="cost_piese"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCostManopera} className="text-sm">
            Cost manoperă (lei)
          </label>
          <input
            id={idCostManopera}
            name="cost_manopera"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className="rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
        </div>

        <div aria-live="polite" className="sm:col-span-2">
          {eroare === null ? null : (
            <p role="alert" className="text-sm text-danger">
              {eroare}
            </p>
          )}
        </div>

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={inCurs}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
          >
            {inCurs ? "Se salvează…" : "Confirmă rezolvarea"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPanou("inchis");
              setEroare(null);
            }}
            disabled={inCurs}
            className="rounded-md border border-foreground/60 px-4 py-2 text-sm font-medium hover:bg-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
          >
            Renunță
          </button>
        </div>
      </form>
    );
  }

  if (panou === "respingere") {
    return (
      <div className="space-y-2 rounded-md border border-border p-3">
        <div>
          <label htmlFor={idMotiv} className="block text-xs font-medium">
            Motivul respingerii *
          </label>
          <input
            id={idMotiv}
            value={motivRespingere}
            onChange={(eveniment) => {
              setMotivRespingere(eveniment.target.value);
            }}
            className="mt-1 w-full rounded-md border border-foreground/60 px-2 py-1.5 text-sm"
          />
        </div>
        <div aria-live="polite">
          {eroare === null ? null : <p className="text-xs text-danger">{eroare}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={inCurs}
            onClick={() => {
              triaza("respins");
            }}
            className="rounded-md bg-danger px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-danger disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
          >
            {inCurs ? "Se salvează…" : "Confirmă respingerea"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPanou("inchis");
              setEroare(null);
            }}
            className="rounded-md border border-foreground/60 px-3 py-1.5 text-sm font-medium hover:bg-surface"
          >
            Renunță
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div aria-live="polite">
        {eroare === null ? null : (
          <p role="alert" className="text-sm text-danger">
            {eroare}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            triaza("in_analiza");
          }}
          className="rounded-md border border-foreground/60 px-3 py-1.5 text-sm font-medium hover:bg-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          În analiză
        </button>
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            triaza("in_lucru");
          }}
          className="rounded-md border border-foreground/60 px-3 py-1.5 text-sm font-medium hover:bg-surface disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          <Wrench aria-hidden="true" className="mr-1 inline size-3.5" />
          În lucru
        </button>
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            setPanou("rezolvare");
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          <Check aria-hidden="true" className="size-4" />
          Rezolvă
        </button>
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            setPanou("respingere");
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-danger px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger hover:text-danger-foreground disabled:cursor-not-allowed disabled:border-border disabled:bg-surface disabled:text-muted-foreground"
        >
          <X aria-hidden="true" className="size-4" />
          Respinge
        </button>
      </div>
    </div>
  );
}
