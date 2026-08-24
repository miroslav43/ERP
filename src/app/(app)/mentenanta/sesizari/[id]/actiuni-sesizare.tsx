"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Wrench, X } from "lucide-react";

import { Buton } from "@/components/ui/buton";
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
        className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
      >
        <p className="text-corp font-medium sm:col-span-2">
          Rezolvarea creează intervenția care a rezolvat defecțiunea.
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor={idData} className="text-corp">
            Data intervenției
          </label>
          <input
            id={idData}
            name="data"
            type="date"
            required
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idRezultat} className="text-corp">
            Rezultat
          </label>
          <select
            id={idRezultat}
            name="rezultat"
            defaultValue="reusita"
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          >
            {REZULTATE_INTERVENTIE.map((r) => (
              <option key={r} value={r}>
                {ETICHETE_REZULTAT_INTERVENTIE[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={idDescriere} className="text-corp">
            Ce s-a făcut
          </label>
          <textarea
            id={idDescriere}
            name="descriere"
            rows={3}
            required
            minLength={3}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCostPiese} className="text-corp">
            Cost piese (lei)
          </label>
          <input
            id={idCostPiese}
            name="cost_piese"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={idCostManopera} className="text-corp">
            Cost manoperă (lei)
          </label>
          <input
            id={idCostManopera}
            name="cost_manopera"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          />
        </div>

        <div aria-live="polite" className="sm:col-span-2">
          {eroare === null ? null : (
            <p role="alert" className="text-danger text-corp">
              {eroare}
            </p>
          )}
        </div>

        <div className="flex gap-2 sm:col-span-2">
          <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
            Confirmă rezolvarea
          </Buton>
          <Buton
            varianta="secundar"
            disabled={inCurs}
            onClick={() => {
              setPanou("inchis");
              setEroare(null);
            }}
          >
            Renunță
          </Buton>
        </div>
      </form>
    );
  }

  if (panou === "respingere") {
    return (
      <div className="border-border rounded-control space-y-2 border p-3">
        <div>
          <label htmlFor={idMotiv} className="text-nota block font-medium">
            Motivul respingerii *
          </label>
          <input
            id={idMotiv}
            value={motivRespingere}
            onChange={(eveniment) => {
              setMotivRespingere(eveniment.target.value);
            }}
            className="border-foreground/60 rounded-control text-corp mt-1 w-full border px-2 py-1.5"
          />
        </div>
        <div aria-live="polite">
          {eroare === null ? null : <p className="text-danger text-nota">{eroare}</p>}
        </div>
        <div className="flex gap-2">
          <Buton
            varianta="distructiv"
            inCurs={inCurs}
            textInCurs="Se salvează…"
            onClick={() => {
              triaza("respins");
            }}
          >
            Confirmă respingerea
          </Buton>
          <Buton
            varianta="secundar"
            onClick={() => {
              setPanou("inchis");
              setEroare(null);
            }}
          >
            Renunță
          </Buton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div aria-live="polite">
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Buton
          varianta="secundar"
          disabled={inCurs}
          onClick={() => {
            triaza("in_analiza");
          }}
        >
          În analiză
        </Buton>
        <Buton
          varianta="secundar"
          disabled={inCurs}
          onClick={() => {
            triaza("in_lucru");
          }}
        >
          <Wrench aria-hidden="true" className="size-4" />
          În lucru
        </Buton>
        <Buton
          varianta="primar"
          disabled={inCurs}
          onClick={() => {
            setPanou("rezolvare");
          }}
        >
          <Check aria-hidden="true" className="size-4" />
          Rezolvă
        </Buton>
        <Buton
          varianta="distructiv"
          disabled={inCurs}
          onClick={() => {
            setPanou("respingere");
          }}
        >
          <X aria-hidden="true" className="size-4" />
          Respinge
        </Buton>
      </div>
    </div>
  );
}
