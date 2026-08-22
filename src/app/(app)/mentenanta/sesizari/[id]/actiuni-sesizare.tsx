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
        className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
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
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
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
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
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
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
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
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
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
            className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
          />
        </div>

        <div aria-live="polite" className="sm:col-span-2">
          {eroare === null ? null : (
            <p role="alert" className="text-danger text-sm">
              {eroare}
            </p>
          )}
        </div>

        <div className="flex gap-2 sm:col-span-2">
          <button
            type="submit"
            disabled={inCurs}
            className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
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
            className="border-foreground/60 hover:bg-surface disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
          >
            Renunță
          </button>
        </div>
      </form>
    );
  }

  if (panou === "respingere") {
    return (
      <div className="border-border space-y-2 rounded-md border p-3">
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
            className="border-foreground/60 mt-1 w-full rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
        <div aria-live="polite">
          {eroare === null ? null : <p className="text-danger text-xs">{eroare}</p>}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={inCurs}
            onClick={() => {
              triaza("respins");
            }}
            className="bg-danger text-primary-foreground hover:bg-danger disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
          >
            {inCurs ? "Se salvează…" : "Confirmă respingerea"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPanou("inchis");
              setEroare(null);
            }}
            className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-1.5 text-sm font-medium"
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
          <p role="alert" className="text-danger text-sm">
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
          className="border-foreground/60 hover:bg-surface disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
        >
          În analiză
        </button>
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            triaza("in_lucru");
          }}
          className="border-foreground/60 hover:bg-surface disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
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
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
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
          className="border-danger text-danger hover:bg-danger hover:text-danger-foreground disabled:border-border disabled:bg-surface disabled:text-muted-foreground inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed"
        >
          <X aria-hidden="true" className="size-4" />
          Respinge
        </button>
      </div>
    </div>
  );
}
