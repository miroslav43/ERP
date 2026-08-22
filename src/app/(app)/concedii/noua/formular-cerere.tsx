// src/app/(app)/concedii/noua/formular-cerere.tsx
"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { numaraZileCerere, type PortiuneZi } from "@/domain/leave/zile-cerere";
import { formatAmount } from "@/lib/format/money";
import { ETICHETE_PORTIUNE } from "../etichete";
import { creeazaCerereConcediu } from "../actions";

interface TipConcediu {
  readonly id: string;
  readonly denumire: string;
  readonly culoare: string;
  readonly zile_implicite: number;
  readonly scade_din_sold: boolean;
  readonly necesita_document: boolean;
}

interface Angajat {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

interface Proprietati {
  readonly tipuri: readonly TipConcediu[];
  readonly sarbatoriRo: readonly string[];
  readonly liberSuplimentar: readonly string[];
  readonly zileRecuperare: readonly string[];
  readonly angajati: readonly Angajat[] | null;
  readonly soldPropriu: Readonly<Record<string, number>> | null;
}

const PORTIUNI: readonly PortiuneZi[] = ["zi_intreaga", "prima_jumatate", "a_doua_jumatate"];

const CLASA_CAMP = "mt-1 w-full rounded-md border border-foreground/60 px-3 py-2 text-sm";

export function FormularCerere({
  tipuri,
  sarbatoriRo,
  liberSuplimentar,
  zileRecuperare,
  angajati,
  soldPropriu,
}: Proprietati) {
  const router = useRouter();
  const primulTip = tipuri[0];

  const [leaveTypeId, setLeaveTypeId] = useState(primulTip?.id ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [dataInceput, setDataInceput] = useState("");
  const [dataSfarsit, setDataSfarsit] = useState("");
  const [portiuneInceput, setPortiuneInceput] = useState<PortiuneZi>("zi_intreaga");
  const [portiuneSfarsit, setPortiuneSfarsit] = useState<PortiuneZi>("zi_intreaga");
  const [motiv, setMotiv] = useState("");
  const [atasamentPath, setAtasamentPath] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const idTip = useId();
  const idAngajat = useId();
  const idInceput = useId();
  const idSfarsit = useId();
  const idPortiuneInceput = useId();
  const idPortiuneSfarsit = useId();
  const idMotiv = useId();
  const idAtasament = useId();

  const tip = tipuri.find((t) => t.id === leaveTypeId) ?? null;

  const previzualizare = useMemo(() => {
    if (dataInceput.length === 0 || dataSfarsit.length === 0) return null;
    try {
      return numaraZileCerere(
        dataInceput,
        dataSfarsit,
        portiuneInceput,
        portiuneSfarsit,
        sarbatoriRo,
        liberSuplimentar,
        zileRecuperare,
      );
    } catch {
      return null;
    }
  }, [
    dataInceput,
    dataSfarsit,
    portiuneInceput,
    portiuneSfarsit,
    sarbatoriRo,
    liberSuplimentar,
    zileRecuperare,
  ]);

  // Soldul e afișat DOAR pentru cereri strict proprii: pentru cine alege un
  // angajat din listă, nu știm soldul lui fără un drum suplimentar la server —
  // verificarea exactă tot se face la trimitere, în acțiune.
  const ramaseAfisate =
    soldPropriu !== null && employeeId.length === 0 && tip !== null
      ? (soldPropriu[tip.id] ?? null)
      : null;

  function trimiteFormular(trimite: boolean): void {
    if (dataInceput.length === 0 || dataSfarsit.length === 0) {
      setEroare("Completați data de început și data de sfârșit.");
      return;
    }
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaCerereConcediu({
        employee_id: employeeId.length === 0 ? null : employeeId,
        leave_type_id: leaveTypeId,
        data_inceput: dataInceput,
        data_sfarsit: dataSfarsit,
        portiune_inceput: portiuneInceput,
        portiune_sfarsit: portiuneSfarsit,
        motiv: motiv.length === 0 ? null : motiv,
        atasament_path: atasamentPath.length === 0 ? null : atasamentPath,
        trimite,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.push(`/concedii/${rezultat.data.id}`);
    });
  }

  return (
    <form
      onSubmit={(eveniment) => {
        eveniment.preventDefault();
      }}
      className="max-w-2xl space-y-6"
      noValidate
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {angajati !== null ? (
          <div className="sm:col-span-2">
            <label htmlFor={idAngajat} className="block text-sm font-medium">
              Pentru angajatul
            </label>
            <select
              id={idAngajat}
              value={employeeId}
              onChange={(eveniment) => {
                setEmployeeId(eveniment.target.value);
              }}
              className={CLASA_CAMP}
            >
              <option value="">Eu însumi</option>
              {angajati.map((angajat) => (
                <option key={angajat.id} value={angajat.id}>
                  {angajat.full_name} ({angajat.marca})
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor={idTip} className="block text-sm font-medium">
            Tip de concediu
          </label>
          <select
            id={idTip}
            value={leaveTypeId}
            onChange={(eveniment) => {
              setLeaveTypeId(eveniment.target.value);
            }}
            className={CLASA_CAMP}
          >
            {tipuri.map((optiune) => (
              <option key={optiune.id} value={optiune.id}>
                {optiune.denumire}
              </option>
            ))}
          </select>
          {tip?.necesita_document ? (
            <p className="text-foreground mt-1 text-xs">
              Acest tip de concediu necesită un document justificativ atașat înainte de trimitere.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={idInceput} className="block text-sm font-medium">
            Data de început *
          </label>
          <input
            id={idInceput}
            type="date"
            required
            value={dataInceput}
            onChange={(eveniment) => {
              setDataInceput(eveniment.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>

        <div>
          <label htmlFor={idPortiuneInceput} className="block text-sm font-medium">
            Porțiunea zilei de început
          </label>
          <select
            id={idPortiuneInceput}
            value={portiuneInceput}
            onChange={(eveniment) => {
              setPortiuneInceput(eveniment.target.value as PortiuneZi);
            }}
            className={CLASA_CAMP}
          >
            {PORTIUNI.map((portiune) => (
              <option key={portiune} value={portiune}>
                {ETICHETE_PORTIUNE[portiune]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={idSfarsit} className="block text-sm font-medium">
            Data de sfârșit *
          </label>
          <input
            id={idSfarsit}
            type="date"
            required
            value={dataSfarsit}
            onChange={(eveniment) => {
              setDataSfarsit(eveniment.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>

        <div>
          <label htmlFor={idPortiuneSfarsit} className="block text-sm font-medium">
            Porțiunea zilei de sfârșit
          </label>
          <select
            id={idPortiuneSfarsit}
            value={portiuneSfarsit}
            onChange={(eveniment) => {
              setPortiuneSfarsit(eveniment.target.value as PortiuneZi);
            }}
            className={CLASA_CAMP}
          >
            {PORTIUNI.map((portiune) => (
              <option key={portiune} value={portiune}>
                {ETICHETE_PORTIUNE[portiune]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={idMotiv} className="block text-sm font-medium">
            Motiv (opțional)
          </label>
          <textarea
            id={idMotiv}
            rows={3}
            value={motiv}
            onChange={(eveniment) => {
              setMotiv(eveniment.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor={idAtasament} className="block text-sm font-medium">
            Calea documentului justificativ (opțional)
          </label>
          <input
            id={idAtasament}
            type="text"
            value={atasamentPath}
            onChange={(eveniment) => {
              setAtasamentPath(eveniment.target.value);
            }}
            placeholder="Ex. concedii/2026/certificat-123.pdf"
            className={CLASA_CAMP}
          />
        </div>
      </div>

      <div aria-live="polite" className="border-border bg-surface rounded-lg border p-4 text-sm">
        {previzualizare === null ? (
          <p className="text-muted-foreground">
            Completați ambele date pentru a vedea câte zile lucrătoare consumă cererea.
          </p>
        ) : (
          <>
            <p>
              Cererea consumă{" "}
              <strong>{formatAmount(previzualizare.zileLucratoare)} zile lucrătoare</strong> din{" "}
              {previzualizare.zileCalendaristice} zile calendaristice.
            </p>
            {tip !== null && !tip.scade_din_sold ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Acest tip de concediu nu scade din soldul de zile.
              </p>
            ) : ramaseAfisate !== null ? (
              <p className="mt-1">
                Aveți <strong>{formatAmount(ramaseAfisate)}</strong> zile rămase; după această
                cerere:{" "}
                <strong>{formatAmount(ramaseAfisate - previzualizare.zileLucratoare)}</strong>.
              </p>
            ) : (
              <p className="text-muted-foreground mt-1 text-xs">
                Soldul disponibil se verifică exact la trimitere.
              </p>
            )}
          </>
        )}
      </div>

      <div aria-live="polite">
        {eroare !== null ? (
          <p className="border-danger bg-danger/8 text-danger rounded-md border p-3 text-sm">
            {eroare}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            trimiteFormular(false);
          }}
          className="border-foreground/60 hover:bg-surface disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md border px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se salvează…" : "Salvează ca ciornă"}
        </button>
        <button
          type="button"
          disabled={inCurs}
          onClick={() => {
            trimiteFormular(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se trimite…" : "Trimite spre aprobare"}
        </button>
      </div>
    </form>
  );
}
