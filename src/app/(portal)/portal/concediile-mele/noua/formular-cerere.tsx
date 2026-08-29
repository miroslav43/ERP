"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { numaraZileCerere, type PortiuneZi } from "@/domain/leave/zile-cerere";
import { creeazaCerereConcediu } from "@/app/(app)/concedii/actions";
import { ETICHETE_PORTIUNE } from "@/app/(app)/concedii/etichete";
import { IncarcareDocumentConcediu } from "@/app/(app)/concedii/incarcare-document";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import type { ActionResult } from "@/lib/actions/types";
import { formatAmount } from "@/lib/format/money";

/**
 * Cererea de concediu, varianta angajatului.
 *
 * Variantă proprie, nu o parametrizare a celei din `(app)`, din trei motive:
 * acolo există un selector „pentru angajatul”, care aici n-are sens; există un
 * câmp liber `atasament_path`, în care omul ar trebui să tasteze o cale de
 * storage — pe telefon, absurd; iar redirecționarea de după salvare duce în
 * aplicația mare. Se dublează RANDAREA, nu regula: aceeași funcție pură
 * `numaraZileCerere` și exact aceeași Server Action.
 *
 * Jumătățile de zi apar doar la cerere. Sunt reale și folosite, dar patru
 * controale în plus pe un ecran de telefon, pentru un caz din douăzeci, mută
 * costul asupra celor nouăsprezece.
 *
 * Pânza e a portalului, dar controalele sunt ale aceleiași primitive `Camp`:
 * ținta de atingere de 44px vine din `pointer-coarse:h-11`, nu dintr-un
 * `min-h-11` scris local — deci nu se poate pierde la următoarea atingere.
 */

interface TipConcediu {
  readonly id: string;
  /** Cheia din bază; `medical` deschide secțiunea de certificat. */
  readonly key: string;
  readonly denumire: string;
  readonly scade_din_sold: boolean;
  readonly necesita_document: boolean;
}

interface VariantaConcediu {
  readonly id: string;
  readonly leave_type_key: string;
  readonly denumire: string;
  readonly zile: number;
  readonly conditie_descriere: string;
}

interface CodMedical {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly procent: number;
  readonly zileAngajator: number;
  readonly platitor: "angajator" | "fnuass" | "mixt";
}

const ETICHETE_PLATITOR: Readonly<Record<CodMedical["platitor"], string>> = {
  angajator: "suportat integral de firmă",
  fnuass: "suportat integral de FNUASS",
  mixt: "primele zile de firmă, restul de la FNUASS",
};

const PORTIUNI: readonly PortiuneZi[] = ["zi_intreaga", "prima_jumatate", "a_doua_jumatate"];

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

export function FormularCererePortal({
  tipuri,
  coduriMedicale,
  variante,
  sarbatoriRo,
  liberSuplimentar,
  zileRecuperare,
  soldPeTip,
}: {
  readonly tipuri: readonly TipConcediu[];
  readonly coduriMedicale: readonly CodMedical[];
  readonly variante: readonly VariantaConcediu[];
  readonly sarbatoriRo: readonly string[];
  readonly liberSuplimentar: readonly string[];
  readonly zileRecuperare: readonly string[];
  readonly soldPeTip: Readonly<Record<string, number>>;
}) {
  const router = useRouter();
  const primulTip = tipuri[0];

  // Controlate rămân doar câmpurile care hrănesc previzualizarea sau deschid
  // alte câmpuri; starea lor supraviețuiește oricum unei erori de validare.
  // Restul sunt necontrolate și își reiau valoarea din `stare.valoriTrimise`.
  const [leaveTypeId, setLeaveTypeId] = useState(primulTip?.id ?? "");
  const [dataInceput, setDataInceput] = useState("");
  const [dataSfarsit, setDataSfarsit] = useState("");
  const [portiuneInceput, setPortiuneInceput] = useState<PortiuneZi>("zi_intreaga");
  const [portiuneSfarsit, setPortiuneSfarsit] = useState<PortiuneZi>("zi_intreaga");
  const [aratăJumatati, setAratăJumatati] = useState(false);
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
      // Interval imposibil (sfârșit înaintea începutului, dată inexistentă):
      // previzualizarea dispare, iar acțiunea refuză explicit la trimitere.
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

  const ramase = tip === null ? null : (soldPeTip[tip.id] ?? null);
  const dupaCerere =
    ramase === null || previzualizare === null ? null : ramase - previzualizare.zileLucratoare;

  /**
   * Numele din `FormData` sunt EXACT cheile lui `creeazaCerereSchema`
   * (`src/schemas/leave.ts`): `leave_type_id`, `data_inceput`, `data_sfarsit`,
   * `portiune_inceput`, `portiune_sfarsit`, `motiv`, `leave_variant_id`,
   * `medical_code_id`, `serie_certificat`, `numar_certificat`. Fără potrivirea
   * asta, `fieldErrors` întors de acțiune n-ar mai găsi niciun câmp, iar
   * mesajul ar dispărea în tăcere.
   *
   * `employee_id` rămâne `null` și nu are câmp: acțiunea rezolvă fișa pe
   * server, din sesiune — un identificator venit din formular ar putea fi al
   * altcuiva.
   *
   * `atasament_path` NU mai lipsește. Lipsea „deliberat", pe motiv că un câmp
   * de cale de storage tastat pe telefon e absurd — ceea ce era adevărat, dar
   * concluzia greșită: consecința n-a fost un câmp mai puțin, ci nouă tipuri de
   * concediu care nu se puteau trimite deloc din portal.
   * `internal.leave_requests_pregateste` respinge trimiterea unui tip cu
   * `necesita_document` fără atașament, iar ecranul nu oferea niciunul. Acum
   * calea vine dintr-o încărcare reală, prin câmpul ascuns al
   * `IncarcareDocumentConcediu`.
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
      employee_id: null,
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
      router.push(`/portal/concediile-mele/${cerere.id}`);
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
    >
      {(stare) => (
        <>
          <Camp
            nume="leave_type_id"
            eticheta="Tipul de concediu"
            fel="select"
            erori={stare.erori["leave_type_id"] ?? []}
          >
            {(a) => (
              <select
                {...a}
                value={leaveTypeId}
                onChange={(e) => {
                  setLeaveTypeId(e.target.value);
                }}
              >
                {tipuri.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.denumire}
                  </option>
                ))}
              </select>
            )}
          </Camp>

          <IncarcareDocumentConcediu
            cheieTip={tip?.key ?? null}
            necesitaDocument={tip?.necesita_document ?? false}
            erori={stare.erori["atasament_path"] ?? []}
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Camp
              nume="data_inceput"
              eticheta="Din data"
              obligatoriu
              erori={stare.erori["data_inceput"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="date"
                  value={dataInceput}
                  onChange={(e) => {
                    setDataInceput(e.target.value);
                    // Un interval de o zi e cazul cel mai des întâlnit; completarea
                    // automată scutește o atingere din două.
                    if (dataSfarsit.length === 0) setDataSfarsit(e.target.value);
                  }}
                />
              )}
            </Camp>

            <Camp
              nume="data_sfarsit"
              eticheta="Până în data"
              obligatoriu
              erori={stare.erori["data_sfarsit"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="date"
                  value={dataSfarsit}
                  {...(dataInceput.length > 0 ? { min: dataInceput } : {})}
                  onChange={(e) => {
                    setDataSfarsit(e.target.value);
                  }}
                />
              )}
            </Camp>
          </div>

          {aratăJumatati ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Camp
                nume="portiune_inceput"
                eticheta="Prima zi"
                fel="select"
                erori={stare.erori["portiune_inceput"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    value={portiuneInceput}
                    onChange={(e) => {
                      setPortiuneInceput(e.target.value as PortiuneZi);
                    }}
                  >
                    {PORTIUNI.map((p) => (
                      <option key={p} value={p}>
                        {ETICHETE_PORTIUNE[p]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>
              <Camp
                nume="portiune_sfarsit"
                eticheta="Ultima zi"
                fel="select"
                erori={stare.erori["portiune_sfarsit"] ?? []}
              >
                {(a) => (
                  <select
                    {...a}
                    value={portiuneSfarsit}
                    onChange={(e) => {
                      setPortiuneSfarsit(e.target.value as PortiuneZi);
                    }}
                  >
                    {PORTIUNI.map((p) => (
                      <option key={p} value={p}>
                        {ETICHETE_PORTIUNE[p]}
                      </option>
                    ))}
                  </select>
                )}
              </Camp>
            </div>
          ) : (
            <Buton
              varianta="link"
              onClick={() => {
                setAratăJumatati(true);
              }}
            >
              Am nevoie de jumătăți de zi
            </Buton>
          )}

          {varianteTip.length > 0 && (
            <Camp
              nume="leave_variant_id"
              eticheta="Variantă legală"
              fel="select"
              erori={stare.erori["leave_variant_id"] ?? []}
              {...(variantaAleasa !== null
                ? {
                    ajutor: `${variantaAleasa.conditie_descriere} Va trebui să atașezi documentul justificativ.`,
                  }
                : {})}
            >
              {(a) => (
                <select
                  {...a}
                  value={variantaId}
                  onChange={(e) => {
                    setVariantaId(e.target.value);
                  }}
                >
                  <option value="">Varianta de bază</option>
                  {varianteTip.map((varianta) => (
                    <option key={varianta.id} value={varianta.id}>
                      {varianta.denumire} — {formatAmount(varianta.zile)} zile
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          )}

          {esteMedical && (
            <fieldset className="border-border bg-surface rounded-panou border p-4">
              <legend className="text-corp px-1 font-medium">Certificatul medical</legend>
              <p className="text-muted-foreground text-corp mb-3">
                Trece codul de pe certificatul primit de la medic. El decide procentul indemnizației
                și cine o suportă.
              </p>

              <div className="space-y-4">
                <Camp
                  nume="medical_code_id"
                  eticheta="Cod de indemnizație"
                  fel="select"
                  obligatoriu
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
                      onChange={(e) => {
                        setMedicalCodeId(e.target.value);
                      }}
                    >
                      <option value="">Alege codul de pe certificat…</option>
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
          )}

          <Camp
            nume="motiv"
            eticheta="Motiv (opțional)"
            fel="textarea"
            erori={stare.erori["motiv"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                rows={3}
                maxLength={500}
                defaultValue={stare.valoriTrimise["motiv"] ?? ""}
              />
            )}
          </Camp>

          {previzualizare === null ? null : (
            <div className="bg-surface border-border rounded-panou border p-4">
              <p className="text-foreground text-corp">
                <span className="text-titlu font-semibold tabular-nums">
                  {previzualizare.zileLucratoare.toLocaleString("ro-RO")}
                </span>{" "}
                {previzualizare.zileLucratoare === 1 ? "zi lucrătoare" : "zile lucrătoare"}
                <span className="text-muted-foreground">
                  {" "}
                  · {previzualizare.zileCalendaristice.toLocaleString("ro-RO")} calendaristice
                </span>
              </p>
              {tip?.scade_din_sold === true && ramase !== null ? (
                <p className="text-muted-foreground text-corp mt-1">
                  Aveți {ramase.toLocaleString("ro-RO")} zile. După aprobare ar rămâne{" "}
                  <span
                    className={
                      dupaCerere !== null && dupaCerere < 0
                        ? "text-danger font-medium"
                        : "text-foreground font-medium"
                    }
                  >
                    {(dupaCerere ?? 0).toLocaleString("ro-RO")}
                  </span>
                  .
                </p>
              ) : null}
              {/* Previzualizarea e orientativă; soldul se verifică exact la trimitere,
                  în acțiune, unde vede și cererile depuse între timp de altcineva. */}
              <p className="text-muted-foreground text-nota mt-2">
                Cifrele se recalculează exact la trimitere.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Buton
              type="submit"
              varianta="primar"
              className="flex-1"
              disabled={tipuri.length === 0}
              inCurs={stare.inCurs}
              textInCurs="Se trimite…"
              onClick={() => {
                trimiteSpreAprobare.current = true;
                setIntentia("trimitere");
              }}
            >
              Trimite cererea
            </Buton>
            <Buton
              type="submit"
              varianta="secundar"
              disabled={tipuri.length === 0}
              inCurs={stare.inCurs}
              textInCurs="Se salvează…"
              onClick={() => {
                trimiteSpreAprobare.current = false;
                setIntentia("ciorna");
              }}
            >
              Salvează ciornă
            </Buton>
          </div>
        </>
      )}
    </Formular>
  );
}
