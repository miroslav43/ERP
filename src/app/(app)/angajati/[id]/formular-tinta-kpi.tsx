"use client";

import { useId, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";

import { seteazaTintaKpi, stergeTintaKpi } from "../../evaluari/kpi/actions";

/**
 * Ținta unui indicator, pusă anume pentru omul ăsta.
 *
 * `seteazaTintaKpi` și `stergeTintaKpi` existau fără niciun apelant în
 * interfață: ajustarea țintei pe om, cerută explicit de modul, nu se putea face
 * de nicăieri (analiza 2026-10-08, evaluari-L14/P11). Un rând per indicator:
 * ținta implicită a setului, câmpul cu ținta proprie, „Salvează” și „Scoate”.
 */
export function FormularTintaKpi({
  employeeId,
  indicatorId,
  denumire,
  unitate,
  tintaImplicita,
  tinta,
}: Readonly<{
  employeeId: string;
  indicatorId: string;
  denumire: string;
  unitate: string | null;
  tintaImplicita: number | null;
  /** Ținta proprie existentă, cu id-ul rândului; `null` = se aplică implicita. */
  tinta: Readonly<{ id: string; tinta: number }> | null;
}>): ReactElement {
  const router = useRouter();
  const idCamp = useId();
  const [valoare, setValoare] = useState(tinta === null ? "" : String(tinta.tinta));
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  function salveaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await seteazaTintaKpi({
        employee_id: employeeId,
        indicator_id: indicatorId,
        tinta: valoare,
        motiv: null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.fieldErrors?.["tinta"]?.[0] ?? rezultat.error.message);
        return;
      }
      arataToast({ fel: "reusita", text: `Ținta la „${denumire}” a fost pusă.` });
      router.refresh();
    });
  }

  function scoate(): void {
    if (tinta === null) return;
    setEroare(null);
    porneste(async () => {
      const rezultat = await stergeTintaKpi({ id: tinta.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setValoare("");
      arataToast({ fel: "reusita", text: `„${denumire}” revine la ținta setului.` });
      router.refresh();
    });
  }

  return (
    <li className="border-border flex flex-wrap items-end gap-x-3 gap-y-2 border-t py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <label htmlFor={idCamp} className="text-corp block font-medium">
          {denumire}
        </label>
        <p className="text-muted-foreground text-nota">
          Ținta setului: {tintaImplicita === null ? "—" : String(tintaImplicita)}
          {unitate === null ? "" : ` ${unitate}`}
          {tinta === null ? "" : " · are țintă proprie"}
        </p>
      </div>
      <input
        id={idCamp}
        type="number"
        step="any"
        value={valoare}
        onChange={(e) => {
          setValoare(e.target.value);
        }}
        placeholder={tintaImplicita === null ? "țintă" : String(tintaImplicita)}
        className="border-foreground/60 rounded-control text-corp w-28 border px-2 py-1 tabular-nums"
      />
      <Buton
        varianta="secundar"
        disabled={inCurs || valoare.trim().length === 0}
        onClick={salveaza}
        inCurs={inCurs}
        textInCurs="Se salvează…"
      >
        Salvează
      </Buton>
      {tinta === null ? null : (
        <Buton varianta="tertiar" disabled={inCurs} onClick={scoate}>
          Scoate
        </Buton>
      )}
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota w-full">
          {eroare}
        </p>
      )}
    </li>
  );
}
