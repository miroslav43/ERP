"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { formatLei } from "@/lib/format/money";
import { TIPURI_CHELTUIALA } from "@/schemas/per-diem";

import { adaugaCheltuiala } from "../actions";
import { ETICHETE_TIP_CHELTUIALA } from "../etichete";

const CLASA_CAMP = "mt-1 w-full rounded-control border border-foreground/60 px-3 py-2 text-corp";

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
    <div className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2 lg:grid-cols-3">
      <p className="text-corp font-medium sm:col-span-2 lg:col-span-3">Adaugă o cheltuială</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.tip} className="text-corp">
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
        <label htmlFor={id.data} className="text-corp">
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
        <label htmlFor={id.descriere} className="text-corp">
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
        <label htmlFor={id.suma} className="text-corp">
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
        <label htmlFor={id.moneda} className="text-corp">
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
        <label htmlFor={id.curs} className="text-corp">
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
          <p className="text-muted-foreground text-nota">= {formatLei(sumaLei)}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={id.document} className="text-corp">
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
        <Buton varianta="primar" inCurs={inCurs} textInCurs="Se salvează…" onClick={trimite}>
          Adaugă cheltuiala
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
      </div>
    </div>
  );
}
