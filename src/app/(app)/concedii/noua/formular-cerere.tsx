// src/app/(app)/concedii/noua/formular-cerere.tsx
"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { numaraZileCerere, type PortiuneZi } from "@/domain/leave/zile-cerere";
import { formatAmount } from "@/lib/format/money";
import { ETICHETE_PORTIUNE } from "../etichete";
import { creeazaCerereConcediu } from "../actions";

interface TipConcediu {
  readonly id: string;
  /** Cheia din bază; `medical` deschide secțiunea de certificat. */
  readonly key: string;
  readonly denumire: string;
  readonly culoare: string;
  readonly zile_implicite: number;
  readonly scade_din_sold: boolean;
  readonly necesita_document: boolean;
}

interface VariantaConcediu {
  readonly id: string;
  readonly leave_type_key: string;
  readonly denumire: string;
  readonly zile: number;
  readonly conditie_descriere: string;
  readonly temei_legal: string | null;
}

interface CodMedical {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly procent: number;
  readonly zileAngajator: number;
  readonly platitor: "angajator" | "fnuass" | "mixt";
}

interface Angajat {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

interface Proprietati {
  readonly tipuri: readonly TipConcediu[];
  readonly coduriMedicale: readonly CodMedical[];
  readonly variante: readonly VariantaConcediu[];
  readonly sarbatoriRo: readonly string[];
  readonly liberSuplimentar: readonly string[];
  readonly zileRecuperare: readonly string[];
  readonly angajati: readonly Angajat[] | null;
  readonly soldPropriu: Readonly<Record<string, number>> | null;
}

const PORTIUNI: readonly PortiuneZi[] = ["zi_intreaga", "prima_jumatate", "a_doua_jumatate"];

const CLASA_CAMP = "mt-1 w-full rounded-control border border-foreground/60 px-3 py-2 text-corp";

const ETICHETE_PLATITOR: Readonly<Record<CodMedical["platitor"], string>> = {
  angajator: "suportat integral de firmă",
  fnuass: "suportat integral de FNUASS",
  mixt: "primele zile de firmă, restul de la FNUASS",
};

export function FormularCerere({
  tipuri,
  coduriMedicale,
  variante,
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
  const [variantaId, setVariantaId] = useState("");
  const [medicalCodeId, setMedicalCodeId] = useState("");
  const [serieCertificat, setSerieCertificat] = useState("");
  const [numarCertificat, setNumarCertificat] = useState("");
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
  const idVarianta = useId();
  const idCodMedical = useId();
  const idSerie = useId();
  const idNumar = useId();

  const tip = tipuri.find((t) => t.id === leaveTypeId) ?? null;
  const esteMedical = tip?.key === "medical";
  // Variantele legale ale tipului ales — „paternal 15 zile cu atestat" e o
  // variantă a lui `paternal`, nu un tip separat.
  const varianteTip = variante.filter((v) => v.leave_type_key === tip?.key);
  const variantaAleasa = varianteTip.find((v) => v.id === variantaId) ?? null;
  const codAles = coduriMedicale.find((c) => c.id === medicalCodeId) ?? null;

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
    if (esteMedical && medicalCodeId.length === 0) {
      setEroare("Alegeți codul de indemnizație de pe certificatul medical.");
      return;
    }
    if (esteMedical && numarCertificat.trim().length === 0) {
      setEroare("Completați numărul certificatului medical.");
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
        // Certificatul se trimite DOAR pentru concediul medical: acțiunea
        // respinge explicit un certificat atașat altui tip de concediu.
        leave_variant_id: variantaId.length > 0 ? variantaId : null,
        medical_code_id: esteMedical && medicalCodeId.length > 0 ? medicalCodeId : null,
        serie_certificat: esteMedical && serieCertificat.length > 0 ? serieCertificat : null,
        numar_certificat: esteMedical && numarCertificat.length > 0 ? numarCertificat : null,
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
            <label htmlFor={idAngajat} className="text-corp block font-medium">
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
          <label htmlFor={idTip} className="text-corp block font-medium">
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
            <p className="text-foreground text-nota mt-1">
              Acest tip de concediu necesită un document justificativ atașat înainte de trimitere.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={idInceput} className="text-corp block font-medium">
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
          <label htmlFor={idPortiuneInceput} className="text-corp block font-medium">
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
          <label htmlFor={idSfarsit} className="text-corp block font-medium">
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
          <label htmlFor={idPortiuneSfarsit} className="text-corp block font-medium">
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
          <label htmlFor={idMotiv} className="text-corp block font-medium">
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

        {varianteTip.length > 0 ? (
          <div className="sm:col-span-2">
            <label htmlFor={idVarianta} className="text-corp block font-medium">
              Variantă legală
            </label>
            <select
              id={idVarianta}
              value={variantaId}
              onChange={(eveniment) => {
                setVariantaId(eveniment.target.value);
              }}
              className={CLASA_CAMP}
            >
              <option value="">
                Varianta de bază ({formatAmount(tip?.zile_implicite ?? 0)} zile)
              </option>
              {varianteTip.map((varianta) => (
                <option key={varianta.id} value={varianta.id}>
                  {varianta.denumire} — {formatAmount(varianta.zile)} zile
                </option>
              ))}
            </select>
            {variantaAleasa !== null ? (
              <p aria-live="polite" className="text-muted-foreground text-corp mt-1">
                {variantaAleasa.conditie_descriere}
                {variantaAleasa.temei_legal !== null ? ` (${variantaAleasa.temei_legal})` : ""}
              </p>
            ) : null}
          </div>
        ) : null}

        {esteMedical ? (
          <fieldset className="border-border bg-surface rounded-panou border p-4 sm:col-span-2">
            <legend className="text-corp px-1 font-medium">Certificatul medical</legend>
            <p className="text-muted-foreground text-corp mb-3">
              Codul de pe certificat decide procentul indemnizației și câte zile suportă firma din
              bugetul propriu. Fără el indemnizația nu se poate calcula.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor={idCodMedical} className="text-corp block font-medium">
                  Cod de indemnizație
                </label>
                <select
                  id={idCodMedical}
                  value={medicalCodeId}
                  onChange={(eveniment) => {
                    setMedicalCodeId(eveniment.target.value);
                  }}
                  required
                  className={CLASA_CAMP}
                >
                  <option value="">Alegeți codul de pe certificat…</option>
                  {coduriMedicale.map((cod) => (
                    <option key={cod.id} value={cod.id}>
                      {cod.cod} — {cod.denumire} ({formatAmount(cod.procent)}%)
                    </option>
                  ))}
                </select>
                {codAles !== null ? (
                  <p aria-live="polite" className="text-muted-foreground text-corp mt-1">
                    {formatAmount(codAles.procent)}% din baza de calcul,{" "}
                    {ETICHETE_PLATITOR[codAles.platitor]}
                    {codAles.zileAngajator > 0
                      ? ` — primele ${String(codAles.zileAngajator)} zile calendaristice.`
                      : "."}
                  </p>
                ) : null}
              </div>

              <div>
                <label htmlFor={idSerie} className="text-corp block font-medium">
                  Seria (opțional)
                </label>
                <input
                  id={idSerie}
                  type="text"
                  value={serieCertificat}
                  onChange={(eveniment) => {
                    setSerieCertificat(eveniment.target.value);
                  }}
                  maxLength={20}
                  className={CLASA_CAMP}
                />
              </div>

              <div>
                <label htmlFor={idNumar} className="text-corp block font-medium">
                  Numărul certificatului
                </label>
                <input
                  id={idNumar}
                  type="text"
                  value={numarCertificat}
                  onChange={(eveniment) => {
                    setNumarCertificat(eveniment.target.value);
                  }}
                  maxLength={30}
                  required
                  className={CLASA_CAMP}
                />
              </div>
            </div>
          </fieldset>
        ) : null}

        <div className="sm:col-span-2">
          <label htmlFor={idAtasament} className="text-corp block font-medium">
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

      <div
        aria-live="polite"
        className="border-border bg-surface rounded-panou text-corp border p-4"
      >
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
              <p className="text-muted-foreground text-nota mt-1">
                Acest tip de concediu nu scade din soldul de zile.
              </p>
            ) : ramaseAfisate !== null ? (
              <p className="mt-1">
                Aveți <strong>{formatAmount(ramaseAfisate)}</strong> zile rămase; după această
                cerere:{" "}
                <strong>{formatAmount(ramaseAfisate - previzualizare.zileLucratoare)}</strong>.
              </p>
            ) : (
              <p className="text-muted-foreground text-nota mt-1">
                Soldul disponibil se verifică exact la trimitere.
              </p>
            )}
          </>
        )}
      </div>

      <div aria-live="polite">
        {eroare !== null ? (
          <p className="border-danger bg-danger/8 text-danger rounded-control text-corp border p-3">
            {eroare}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <Buton
          varianta="secundar"
          inCurs={inCurs}
          textInCurs="Se salvează…"
          onClick={() => {
            trimiteFormular(false);
          }}
        >
          Salvează ca ciornă
        </Buton>
        <Buton
          varianta="primar"
          inCurs={inCurs}
          textInCurs="Se trimite…"
          onClick={() => {
            trimiteFormular(true);
          }}
        >
          Trimite spre aprobare
        </Buton>
      </div>
    </form>
  );
}
