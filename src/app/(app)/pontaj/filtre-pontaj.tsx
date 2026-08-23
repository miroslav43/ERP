"use client";

import { useId, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Buton } from "@/components/ui/buton";

interface Departament {
  readonly id: string;
  readonly denumire: string;
}

interface Proprietati {
  readonly an: number;
  /**
   * Luna EFECTIV afișată, calculată server-side (`filtrePontajSchema`, cu
   * implicitul ei pe luna curentă) — nu `useSearchParams()`: la o intrare
   * proaspătă pe `/pontaj`, fără `?luna=`, query string-ul e gol, iar
   * selectul ar cădea pe prima opțiune („ianuarie”) deși foaia afișată e a
   * lunii curente. Primind valoarea reală ca proprietate, selectul o arată
   * corect din primul randare, indiferent dacă a venit din URL sau din
   * implicitul schemei.
   */
  readonly luna: number;
  readonly departamente: readonly Departament[];
}

const LUNI_ETICHETE = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
] as const;

/**
 * Filtrele foii colective: an, lună, departament, căutare după nume.
 *
 * `departamente` goală (rolul curent nu are `departments:read`, sau
 * organizația nu are niciunul activ) ⇒ selectul de departament nu se
 * randează deloc — un filtru care nu ar întoarce niciodată o alegere e mai
 * rău decât lipsa lui.
 */
export function FiltrePontaj({ an, luna, departamente }: Proprietati) {
  const router = useRouter();
  const cale = usePathname();
  const parametri = useSearchParams();
  const [inCurs, porneste] = useTransition();
  const idAn = useId();
  const idLuna = useId();
  const idDepartament = useId();
  const idCauta = useId();

  function aplica(formular: FormData): void {
    const noi = new URLSearchParams();
    const anAles = String(formular.get("an") ?? "");
    const luna = String(formular.get("luna") ?? "");
    const departament = String(formular.get("departament") ?? "");
    const cauta = String(formular.get("cauta") ?? "").trim();
    if (anAles.length > 0) noi.set("an", anAles);
    if (luna.length > 0) noi.set("luna", luna);
    if (departament.length > 0) noi.set("departament", departament);
    if (cauta.length > 0) noi.set("cauta", cauta);
    // `cursor` se pierde intenționat: filtre noi înseamnă prima pagină.
    porneste(() => {
      router.replace(`${cale}?${noi.toString()}`);
    });
  }

  return (
    <form
      action={aplica}
      className="border-border rounded-panou flex flex-wrap items-end gap-3 border p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idAn} className="text-corp font-medium">
          An
        </label>
        <input
          id={idAn}
          name="an"
          type="number"
          min={2000}
          max={2100}
          defaultValue={an}
          className="border-foreground/60 rounded-control text-corp w-24 border px-3 py-2"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idLuna} className="text-corp font-medium">
          Luna
        </label>
        <select
          id={idLuna}
          name="luna"
          defaultValue={luna}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          {LUNI_ETICHETE.map((eticheta, index) => (
            <option key={eticheta} value={index + 1}>
              {eticheta}
            </option>
          ))}
        </select>
      </div>

      {departamente.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <label htmlFor={idDepartament} className="text-corp font-medium">
            Departament
          </label>
          <select
            id={idDepartament}
            name="departament"
            defaultValue={parametri.get("departament") ?? ""}
            className="border-foreground/60 rounded-control text-corp border px-3 py-2"
          >
            <option value="">Toate</option>
            {departamente.map((d) => (
              <option key={d.id} value={d.id}>
                {d.denumire}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={idCauta} className="text-corp font-medium">
          Angajat
        </label>
        <input
          id={idCauta}
          name="cauta"
          type="search"
          defaultValue={parametri.get("cauta") ?? ""}
          placeholder="Nume angajat"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>

      <Buton type="submit" varianta="secundar" inCurs={inCurs} textInCurs="Se filtrează…">
        <Search aria-hidden="true" className="size-4" />
        Filtrează
      </Buton>
    </form>
  );
}
