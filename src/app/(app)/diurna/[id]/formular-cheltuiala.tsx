"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { formatLei } from "@/lib/format/money";
import { TIPURI_CHELTUIALA } from "@/schemas/per-diem";

import { adaugaCheltuiala } from "../actions";
import { ETICHETE_TIP_CHELTUIALA } from "../etichete";

const CLASA_CAMP = "mt-1 w-full rounded-md border border-foreground/60 px-3 py-2 text-sm";

/**
 * Adaugă o cheltuială decontabilă (`trip_expenses`).
 *
 * `curs_valutar` e OBLIGATORIU în bază (NOT NULL, > 0) — se cere explicit
 * aici, nu se deduce. Conversia se afișează live: sumă × curs.
 */
export function FormularCheltuiala({ tripId }: { readonly tripId: string }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  const [tip, setTip] = useState<(typeof TIPURI_CHELTUIALA)[number]>("cazare");
  const [descriere, setDescriere] = useState("");
  const [dataCheltuielii, setDataCheltuielii] = useState("");
  const [suma, setSuma] = useState("");
  const [moneda, setMoneda] = useState("RON");
  const [cursValutar, setCursValutar] = useState("1");
  const [documentNumar, setDocumentNumar] = useState("");

  const id = {
    tip: useId(),
    descriere: useId(),
    data: useId(),
    suma: useId(),
    moneda: useId(),
    curs: useId(),
    document: useId(),
  };

  const sumaLei = useMemo(() => {
    const s = Number(suma);
    const c = Number(cursValutar);
    if (!Number.isFinite(s) || !Number.isFinite(c) || s <= 0 || c <= 0) return null;
    return s * c;
  }, [suma, cursValutar]);

  function trimite(): void {
    if (dataCheltuielii.length === 0) {
      setEroare("Completați data cheltuielii.");
      return;
    }
    const sumaNum = Number(suma);
    const cursNum = Number(cursValutar);
    if (!Number.isFinite(sumaNum) || sumaNum <= 0) {
      setEroare("Suma trebuie să fie mai mare decât zero.");
      return;
    }
    if (!Number.isFinite(cursNum) || cursNum <= 0) {
      setEroare("Cursul valutar trebuie să fie mai mare decât zero.");
      return;
    }
    setEroare(null);
    porneste(async () => {
      const rezultat = await adaugaCheltuiala({
        business_trip_id: tripId,
        tip,
        descriere: descriere.length === 0 ? null : descriere,
        data_cheltuielii: dataCheltuielii,
        suma: sumaNum,
        moneda,
        curs_valutar: cursNum,
        document_tip: null,
        document_numar: documentNumar.length === 0 ? null : documentNumar,
        document_cale: null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDescriere("");
      setDataCheltuielii("");
      setSuma("");
      setDocumentNumar("");
      router.refresh();
    });
  }

  return (
    <div className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-3">
      <p className="text-sm font-medium sm:col-span-2 lg:col-span-3">Adaugă o cheltuială</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.tip} className="text-sm">
          Tip
        </label>
        <select
          id={id.tip}
          value={tip}
          onChange={(e) => {
            setTip(e.target.value as (typeof TIPURI_CHELTUIALA)[number]);
          }}
          className={CLASA_CAMP}
        >
          {TIPURI_CHELTUIALA.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_CHELTUIALA[t]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.data} className="text-sm">
          Data cheltuielii
        </label>
        <input
          id={id.data}
          type="date"
          value={dataCheltuielii}
          onChange={(e) => {
            setDataCheltuielii(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.descriere} className="text-sm">
          Descriere (opțional)
        </label>
        <input
          id={id.descriere}
          type="text"
          maxLength={500}
          value={descriere}
          onChange={(e) => {
            setDescriere(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.suma} className="text-sm">
          Suma
        </label>
        <input
          id={id.suma}
          type="number"
          min="0"
          step="0.01"
          value={suma}
          onChange={(e) => {
            setSuma(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.moneda} className="text-sm">
          Moneda
        </label>
        <input
          id={id.moneda}
          type="text"
          maxLength={3}
          value={moneda}
          onChange={(e) => {
            setMoneda(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.curs} className="text-sm">
          Curs valutar (1 {moneda || "monedă"} = ? lei)
        </label>
        <input
          id={id.curs}
          type="number"
          min="0"
          step="0.000001"
          value={cursValutar}
          onChange={(e) => {
            setCursValutar(e.target.value);
          }}
          className={CLASA_CAMP}
        />
        {sumaLei === null ? null : (
          <p className="text-muted-foreground text-xs">= {formatLei(sumaLei)}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.document} className="text-sm">
          Număr document (opțional)
        </label>
        <input
          id={id.document}
          type="text"
          maxLength={60}
          value={documentNumar}
          onChange={(e) => {
            setDocumentNumar(e.target.value);
          }}
          className={CLASA_CAMP}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button
          type="button"
          disabled={inCurs}
          onClick={trimite}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se salvează…" : "Adaugă cheltuiala"}
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-sm">
            {eroare}
          </p>
        )}
      </div>
    </div>
  );
}
