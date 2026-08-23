// src/app/(app)/angajati/[id]/sectiune-dependenti.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { RELATII_INTRETINERE, type RelatieIntretinere } from "@/schemas/employee";
import { formatDate } from "@/lib/format/date";

import { adaugaPersoanaIntretinere, stergePersoanaIntretinere } from "./dependenti-actions";

export interface RandDependent {
  readonly id: string;
  readonly nume: string;
  readonly relatie: RelatieIntretinere;
  readonly data_nasterii: string | null;
  readonly in_intretinere_de_la: string;
  readonly in_intretinere_pana_la: string | null;
}

const ETICHETE_RELATIE: Readonly<Record<RelatieIntretinere, string>> = {
  copil: "Copil",
  sot_sotie: "Soț/soție",
  parinte: "Părinte",
  alta_ruda: "Altă rudă",
};

const CLASA_CAMP = "border-foreground/60 rounded-md border px-3 py-2 text-sm";

/**
 * Persoanele în întreținere ale angajatului.
 *
 * Numărul lor decide DEDUCEREA PERSONALĂ din calculul salarial — până în 0069
 * era un simplu contor pe fișă, care funcționa dar nu se putea dovedi la un
 * control fiscal. Contorul se recalculează singur din lista asta, prin trigger:
 * ecranul nu-l atinge niciodată.
 */
export function SectiuneDependenti({
  employeeId,
  dependenti,
  poateEdita,
}: {
  readonly employeeId: string;
  readonly dependenti: readonly RandDependent[];
  readonly poateEdita: boolean;
}) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  const idNume = useId();
  const idRelatie = useId();
  const idNastere = useId();
  const idDeLa = useId();
  const idPanaLa = useId();

  function trimite(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await adaugaPersoanaIntretinere({
        employee_id: employeeId,
        nume: String(fd.get("nume") ?? ""),
        relatie: String(fd.get("relatie") ?? "copil"),
        data_nasterii: String(fd.get("data_nasterii") ?? ""),
        in_intretinere_de_la: String(fd.get("in_intretinere_de_la") ?? ""),
        in_intretinere_pana_la: String(fd.get("in_intretinere_pana_la") ?? ""),
        observatii: null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(false);
      router.refresh();
    });
  }

  function scoate(id: string): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await stergePersoanaIntretinere({ id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          Numărul persoanelor aflate azi în întreținere decide deducerea personală din calculul
          salarial. Se recalculează singur din lista asta.
        </p>
        {poateEdita && !deschis ? (
          <button
            type="button"
            onClick={() => {
              setDeschis(true);
            }}
            className="border-foreground/60 hover:bg-surface shrink-0 rounded-md border px-3 py-1.5 text-sm"
          >
            Adaugă
          </button>
        ) : null}
      </div>

      {deschis ? (
        <form
          action={trimite}
          className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={idNume} className="text-sm font-medium">
              Nume și prenume *
            </label>
            <input
              id={idNume}
              name="nume"
              type="text"
              required
              maxLength={200}
              className={CLASA_CAMP}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idRelatie} className="text-sm font-medium">
              Relația *
            </label>
            <select id={idRelatie} name="relatie" defaultValue="copil" className={CLASA_CAMP}>
              {RELATII_INTRETINERE.map((relatie) => (
                <option key={relatie} value={relatie}>
                  {ETICHETE_RELATIE[relatie]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idNastere} className="text-sm font-medium">
              Data nașterii
            </label>
            <input id={idNastere} name="data_nasterii" type="date" className={CLASA_CAMP} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idDeLa} className="text-sm font-medium">
              În întreținere de la *
            </label>
            <input
              id={idDeLa}
              name="in_intretinere_de_la"
              type="date"
              required
              className={CLASA_CAMP}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idPanaLa} className="text-sm font-medium">
              Până la
            </label>
            <input id={idPanaLa} name="in_intretinere_pana_la" type="date" className={CLASA_CAMP} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={inCurs}
              className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
            >
              {inCurs ? "Se salvează…" : "Salvează"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDeschis(false);
              }}
              className="border-border rounded-md border px-4 py-2 text-sm font-medium"
            >
              Renunță
            </button>
          </div>
        </form>
      ) : null}

      {dependenti.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nicio persoană în întreținere înregistrată.</p>
      ) : (
        <ul className="divide-border divide-y">
          {dependenti.map((dependent) => (
            <li key={dependent.id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{dependent.nume}</p>
                <p className="text-muted-foreground text-xs">
                  {ETICHETE_RELATIE[dependent.relatie]}
                  {dependent.data_nasterii !== null
                    ? ` · născut(ă) ${formatDate(dependent.data_nasterii)}`
                    : ""}{" "}
                  · din {formatDate(dependent.in_intretinere_de_la)}
                  {dependent.in_intretinere_pana_la !== null
                    ? ` până la ${formatDate(dependent.in_intretinere_pana_la)}`
                    : ""}
                </p>
              </div>
              {poateEdita ? (
                <button
                  type="button"
                  disabled={inCurs}
                  onClick={() => {
                    scoate(dependent.id);
                  }}
                  className="border-border shrink-0 rounded-md border px-3 py-1.5 text-sm disabled:opacity-60"
                >
                  Scoate
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-sm">
          {eroare}
        </p>
      )}
    </div>
  );
}
