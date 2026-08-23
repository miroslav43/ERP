// src/app/(app)/concedii/noua/formular-cerere.tsx
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import type { ActionResult } from "@/lib/actions/types";
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

const ETICHETE_PLATITOR: Readonly<Record<CodMedical["platitor"], string>> = {
  angajator: "suportat integral de firmă",
  fnuass: "suportat integral de FNUASS",
  mixt: "primele zile de firmă, restul de la FNUASS",
};

type CerereCreata = Readonly<{ id: string }>;

/**
 * Refuz construit în client, în forma exactă a unui `ActionResult`, ca mesajul
 * să meargă pe aceeași cale ca al serverului și să ajungă lângă câmp, nu sub
 * buton.
 *
 * Se folosește doar pentru regula pe care schema Zod nu o poate exprima: „tipul
 * ales e medical, deci certificatul e obligatoriu”. Schema vede un
 * `leave_type_id`, nu cheia lui, iar acțiunea răspunde cu un mesaj de formular,
 * fără câmp. Schema și acțiunea sunt un contract și nu se ating de aici.
 */
function refuzDeClient(
  fieldErrors: Readonly<Record<string, readonly string[]>>,
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code: "VALIDARE",
      message: "Datele introduse nu sunt valide.",
      fieldErrors,
      requestId: "client",
    },
  };
}

function textSauNull(date: FormData, cheie: string): string | null {
  const valoare = String(date.get(cheie) ?? "").trim();
  return valoare.length === 0 ? null : valoare;
}

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

  // Controlate rămân doar câmpurile care hrănesc previzualizarea sau deschid
  // alte câmpuri; starea lor supraviețuiește oricum unei erori de validare.
  // Restul sunt necontrolate și își reiau valoarea din `stare.valoriTrimise`.
  const [leaveTypeId, setLeaveTypeId] = useState(primulTip?.id ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [dataInceput, setDataInceput] = useState("");
  const [dataSfarsit, setDataSfarsit] = useState("");
  const [portiuneInceput, setPortiuneInceput] = useState<PortiuneZi>("zi_intreaga");
  const [portiuneSfarsit, setPortiuneSfarsit] = useState<PortiuneZi>("zi_intreaga");
  const [variantaId, setVariantaId] = useState("");
  const [medicalCodeId, setMedicalCodeId] = useState("");

  /**
   * Două butoane de trimitere, un singur `action`. Intenția se scrie într-un
   * `ref` din `onClick`-ul butonului, care rulează ÎNAINTE de `submit`: o stare
   * ar fi citită de acțiune încă neactualizată. Starea de alături e doar pentru
   * textul notificării, citit mult mai târziu, după ce acțiunea s-a încheiat.
   */
  const trimiteSpreAprobare = useRef(false);
  const [intentia, setIntentia] = useState<"ciorna" | "trimitere">("ciorna");

  const tip = tipuri.find((t) => t.id === leaveTypeId) ?? null;
  const esteMedical = tip?.key === "medical";
  // Variantele legale ale tipului ales — „paternal 15 zile cu atestat” e o
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

  /**
   * Numele din `FormData` sunt EXACT cheile lui `creeazaCerereSchema`
   * (`src/schemas/leave.ts`): `employee_id`, `leave_type_id`, `data_inceput`,
   * `data_sfarsit`, `portiune_inceput`, `portiune_sfarsit`, `motiv`,
   * `atasament_path`, `leave_variant_id`, `medical_code_id`,
   * `serie_certificat`, `numar_certificat`. Fără potrivirea asta, `fieldErrors`
   * întors de acțiune n-ar mai găsi niciun câmp, iar mesajul ar dispărea în
   * tăcere.
   *
   * Certificatul se trimite DOAR pentru concediul medical — câmpurile lui nici
   * nu există în DOM altfel, deci lipsesc din `FormData`, iar schema le vede
   * `null`. Acțiunea respinge explicit un certificat atașat altui tip.
   */
  async function trimiteCererea(date: FormData): Promise<ActionResult<CerereCreata>> {
    const codMedical = textSauNull(date, "medical_code_id");
    const numarCertificat = textSauNull(date, "numar_certificat");

    if (esteMedical) {
      const lipsa: Record<string, readonly string[]> = {};
      if (codMedical === null) {
        lipsa["medical_code_id"] = ["Alegeți codul de indemnizație de pe certificatul medical."];
      }
      if (numarCertificat === null) {
        lipsa["numar_certificat"] = ["Completați numărul certificatului medical."];
      }
      if (Object.keys(lipsa).length > 0) return refuzDeClient(lipsa);
    }

    return creeazaCerereConcediu({
      employee_id: textSauNull(date, "employee_id"),
      leave_type_id: String(date.get("leave_type_id") ?? ""),
      data_inceput: String(date.get("data_inceput") ?? ""),
      data_sfarsit: String(date.get("data_sfarsit") ?? ""),
      portiune_inceput: String(date.get("portiune_inceput") ?? "zi_intreaga"),
      portiune_sfarsit: String(date.get("portiune_sfarsit") ?? "zi_intreaga"),
      motiv: textSauNull(date, "motiv"),
      atasament_path: textSauNull(date, "atasament_path"),
      leave_variant_id: textSauNull(date, "leave_variant_id"),
      medical_code_id: codMedical,
      serie_certificat: textSauNull(date, "serie_certificat"),
      numar_certificat: numarCertificat,
      trimite: trimiteSpreAprobare.current,
    });
  }

  const laReusita = useCallback(
    (cerere: Readonly<{ id: string }>) => {
      router.push(`/concedii/${cerere.id}`);
    },
    [router],
  );

  return (
    <Formular
      actiune={trimiteCererea}
      laReusita={laReusita}
      mesajReusita={
        intentia === "trimitere"
          ? "Cererea a fost trimisă spre aprobare."
          : "Cererea a fost salvată ca ciornă."
      }
      className="max-w-2xl gap-6"
    >
      {(stare) => (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {angajati !== null ? (
              <Camp
                nume="employee_id"
                eticheta="Pentru angajatul"
                fel="select"
                className="sm:col-span-2"
                erori={stare.erori["employee_id"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    value={employeeId}
                    onChange={(eveniment) => {
                      setEmployeeId(eveniment.target.value);
                    }}
                  >
                    <option value="">Eu însumi</option>
                    {angajati.map((angajat) => (
                      <option key={angajat.id} value={angajat.id}>
                        {angajat.full_name} ({angajat.marca})
                      </option>
                    ))}
                  </select>
                )}
              </Camp>
            ) : null}

            <Camp
              nume="leave_type_id"
              eticheta="Tip de concediu"
              fel="select"
              erori={stare.erori["leave_type_id"] ?? []}
              {...(tip?.necesita_document === true
                ? {
                    ajutor:
                      "Acest tip de concediu necesită un document justificativ atașat înainte de trimitere.",
                  }
                : {})}
            >
              {(a) => (
                <select
                  {...a}
                  value={leaveTypeId}
                  onChange={(eveniment) => {
                    setLeaveTypeId(eveniment.target.value);
                  }}
                >
                  {tipuri.map((optiune) => (
                    <option key={optiune.id} value={optiune.id}>
                      {optiune.denumire}
                    </option>
                  ))}
                </select>
              )}
            </Camp>

            <Camp
              nume="data_inceput"
              eticheta="Data de început"
              obligatoriu
              erori={stare.erori["data_inceput"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="date"
                  value={dataInceput}
                  onChange={(eveniment) => {
                    setDataInceput(eveniment.target.value);
                  }}
                />
              )}
            </Camp>

            <Camp
              nume="portiune_inceput"
              eticheta="Porțiunea zilei de început"
              fel="select"
              erori={stare.erori["portiune_inceput"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  value={portiuneInceput}
                  onChange={(eveniment) => {
                    setPortiuneInceput(eveniment.target.value as PortiuneZi);
                  }}
                >
                  {PORTIUNI.map((portiune) => (
                    <option key={portiune} value={portiune}>
                      {ETICHETE_PORTIUNE[portiune]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>

            <Camp
              nume="data_sfarsit"
              eticheta="Data de sfârșit"
              obligatoriu
              erori={stare.erori["data_sfarsit"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="date"
                  value={dataSfarsit}
                  onChange={(eveniment) => {
                    setDataSfarsit(eveniment.target.value);
                  }}
                />
              )}
            </Camp>

            <Camp
              nume="portiune_sfarsit"
              eticheta="Porțiunea zilei de sfârșit"
              fel="select"
              erori={stare.erori["portiune_sfarsit"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  value={portiuneSfarsit}
                  onChange={(eveniment) => {
                    setPortiuneSfarsit(eveniment.target.value as PortiuneZi);
                  }}
                >
                  {PORTIUNI.map((portiune) => (
                    <option key={portiune} value={portiune}>
                      {ETICHETE_PORTIUNE[portiune]}
                    </option>
                  ))}
                </select>
              )}
            </Camp>

            <Camp
              nume="motiv"
              eticheta="Motiv (opțional)"
              fel="textarea"
              className="sm:col-span-2"
              erori={stare.erori["motiv"] ?? []}
            >
              {(a) => (
                <textarea {...a} rows={3} defaultValue={stare.valoriTrimise["motiv"] ?? ""} />
              )}
            </Camp>

            {varianteTip.length > 0 ? (
              <Camp
                nume="leave_variant_id"
                eticheta="Variantă legală"
                fel="select"
                className="sm:col-span-2"
                erori={stare.erori["leave_variant_id"] ?? []}
                {...(variantaAleasa !== null
                  ? {
                      ajutor:
                        variantaAleasa.temei_legal !== null
                          ? `${variantaAleasa.conditie_descriere} (${variantaAleasa.temei_legal})`
                          : variantaAleasa.conditie_descriere,
                    }
                  : {})}
              >
                {(a) => (
                  <select
                    {...a}
                    value={variantaId}
                    onChange={(eveniment) => {
                      setVariantaId(eveniment.target.value);
                    }}
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
                )}
              </Camp>
            ) : null}

            {esteMedical ? (
              <fieldset className="border-border bg-surface rounded-panou border p-4 sm:col-span-2">
                <legend className="text-corp px-1 font-medium">Certificatul medical</legend>
                <p className="text-muted-foreground text-corp mb-3">
                  Codul de pe certificat decide procentul indemnizației și câte zile suportă firma
                  din bugetul propriu. Fără el indemnizația nu se poate calcula.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Camp
                    nume="medical_code_id"
                    eticheta="Cod de indemnizație"
                    fel="select"
                    obligatoriu
                    className="sm:col-span-2"
                    erori={stare.erori["medical_code_id"] ?? []}
                    {...(codAles !== null
                      ? {
                          ajutor: `${formatAmount(codAles.procent)}% din baza de calcul, ${
                            ETICHETE_PLATITOR[codAles.platitor]
                          }${
                            codAles.zileAngajator > 0
                              ? ` — primele ${String(codAles.zileAngajator)} zile calendaristice.`
                              : "."
                          }`,
                        }
                      : {})}
                  >
                    {(a) => (
                      <select
                        {...a}
                        value={medicalCodeId}
                        onChange={(eveniment) => {
                          setMedicalCodeId(eveniment.target.value);
                        }}
                      >
                        <option value="">Alegeți codul de pe certificat…</option>
                        {coduriMedicale.map((cod) => (
                          <option key={cod.id} value={cod.id}>
                            {cod.cod} — {cod.denumire} ({formatAmount(cod.procent)}%)
                          </option>
                        ))}
                      </select>
                    )}
                  </Camp>

                  <Camp
                    nume="serie_certificat"
                    eticheta="Seria (opțional)"
                    erori={stare.erori["serie_certificat"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="text"
                        maxLength={20}
                        defaultValue={stare.valoriTrimise["serie_certificat"] ?? ""}
                      />
                    )}
                  </Camp>

                  <Camp
                    nume="numar_certificat"
                    eticheta="Numărul certificatului"
                    obligatoriu
                    erori={stare.erori["numar_certificat"] ?? []}
                  >
                    {(a) => (
                      <input
                        {...a}
                        type="text"
                        maxLength={30}
                        defaultValue={stare.valoriTrimise["numar_certificat"] ?? ""}
                      />
                    )}
                  </Camp>
                </div>
              </fieldset>
            ) : null}

            <Camp
              nume="atasament_path"
              eticheta="Calea documentului justificativ (opțional)"
              className="sm:col-span-2"
              erori={stare.erori["atasament_path"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  placeholder="Ex. concedii/2026/certificat-123.pdf"
                  defaultValue={stare.valoriTrimise["atasament_path"] ?? ""}
                />
              )}
            </Camp>
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

          <div className="flex flex-wrap gap-3">
            <Buton
              type="submit"
              varianta="secundar"
              inCurs={stare.inCurs}
              textInCurs="Se salvează…"
              onClick={() => {
                trimiteSpreAprobare.current = false;
                setIntentia("ciorna");
              }}
            >
              Salvează ca ciornă
            </Buton>
            <Buton
              type="submit"
              varianta="primar"
              inCurs={stare.inCurs}
              textInCurs="Se trimite…"
              onClick={() => {
                trimiteSpreAprobare.current = true;
                setIntentia("trimitere");
              }}
            >
              Trimite spre aprobare
            </Buton>
          </div>
        </>
      )}
    </Formular>
  );
}
