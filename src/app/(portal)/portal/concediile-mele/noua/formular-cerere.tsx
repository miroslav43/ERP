"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { numaraZileCerere, type PortiuneZi } from "@/domain/leave/zile-cerere";
import { creeazaCerereConcediu } from "@/app/(app)/concedii/actions";
import { ETICHETE_PORTIUNE } from "@/app/(app)/concedii/etichete";
import { Buton } from "@/components/ui/buton";
import { formatAmount } from "@/lib/format/money";

/**
 * Cererea de concediu, varianta angajatului.
 *
 * Variantă proprie, nu o parametrizare a celei din `(app)`, din trei motive:
 * acolo există un selector „pentru angajatul", care aici n-are sens; există un
 * câmp liber `atasament_path`, în care omul ar trebui să tasteze o cale de
 * storage — pe telefon, absurd; iar redirecționarea de după salvare duce în
 * aplicația mare. Se dublează RANDAREA, nu regula: aceeași funcție pură
 * `numaraZileCerere` și exact aceeași Server Action.
 *
 * Jumătățile de zi apar doar la cerere. Sunt reale și folosite, dar patru
 * controale în plus pe un ecran de telefon, pentru un caz din douăzeci, mută
 * costul asupra celor nouăsprezece.
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

const CLASA_CAMP =
  "mt-1 min-h-11 w-full rounded-control border border-foreground/60 bg-background px-3 py-2 text-corp";

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

  const [leaveTypeId, setLeaveTypeId] = useState(primulTip?.id ?? "");
  const [dataInceput, setDataInceput] = useState("");
  const [dataSfarsit, setDataSfarsit] = useState("");
  const [portiuneInceput, setPortiuneInceput] = useState<PortiuneZi>("zi_intreaga");
  const [portiuneSfarsit, setPortiuneSfarsit] = useState<PortiuneZi>("zi_intreaga");
  const [aratăJumatati, setAratăJumatati] = useState(false);
  const [motiv, setMotiv] = useState("");
  const [variantaId, setVariantaId] = useState("");
  const [medicalCodeId, setMedicalCodeId] = useState("");
  const [serieCertificat, setSerieCertificat] = useState("");
  const [numarCertificat, setNumarCertificat] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  const idTip = useId();
  const idInceput = useId();
  const idSfarsit = useId();
  const idPortiuneInceput = useId();
  const idPortiuneSfarsit = useId();
  const idMotiv = useId();
  const idVarianta = useId();
  const idCodMedical = useId();
  const idSerie = useId();
  const idNumar = useId();

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
        // `null` = pentru mine. Acțiunea rezolvă fișa pe server, din sesiune:
        // un identificator venit din formular ar putea fi al altcuiva.
        employee_id: null,
        leave_type_id: leaveTypeId,
        data_inceput: dataInceput,
        data_sfarsit: dataSfarsit,
        portiune_inceput: portiuneInceput,
        portiune_sfarsit: portiuneSfarsit,
        motiv: motiv.length === 0 ? null : motiv,
        atasament_path: null,
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
      router.push(`/portal/concediile-mele/${rezultat.data.id}`);
    });
  }

  return (
    <form
      onSubmit={(eveniment) => {
        eveniment.preventDefault();
      }}
      className="space-y-4"
      noValidate
    >
      <div>
        <label htmlFor={idTip} className="text-foreground text-corp font-medium">
          Tipul de concediu
        </label>
        <select
          id={idTip}
          value={leaveTypeId}
          onChange={(e) => {
            setLeaveTypeId(e.target.value);
          }}
          className={CLASA_CAMP}
        >
          {tipuri.map((t) => (
            <option key={t.id} value={t.id}>
              {t.denumire}
            </option>
          ))}
        </select>
        {tip?.necesita_document === true ? (
          <p className="text-muted-foreground text-nota mt-1">
            Pentru acest tip veți avea nevoie de un document justificativ. Îl predați resurselor
            umane.
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={idInceput} className="text-foreground text-corp font-medium">
            Din data
          </label>
          <input
            id={idInceput}
            type="date"
            value={dataInceput}
            onChange={(e) => {
              setDataInceput(e.target.value);
              // Un interval de o zi e cazul cel mai des întâlnit; completarea
              // automată scutește o atingere din două.
              if (dataSfarsit.length === 0) setDataSfarsit(e.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>
        <div>
          <label htmlFor={idSfarsit} className="text-foreground text-corp font-medium">
            Până în data
          </label>
          <input
            id={idSfarsit}
            type="date"
            value={dataSfarsit}
            min={dataInceput.length > 0 ? dataInceput : undefined}
            onChange={(e) => {
              setDataSfarsit(e.target.value);
            }}
            className={CLASA_CAMP}
          />
        </div>
      </div>

      {aratăJumatati ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={idPortiuneInceput} className="text-foreground text-corp font-medium">
              Prima zi
            </label>
            <select
              id={idPortiuneInceput}
              value={portiuneInceput}
              onChange={(e) => {
                setPortiuneInceput(e.target.value as PortiuneZi);
              }}
              className={CLASA_CAMP}
            >
              {PORTIUNI.map((p) => (
                <option key={p} value={p}>
                  {ETICHETE_PORTIUNE[p]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={idPortiuneSfarsit} className="text-foreground text-corp font-medium">
              Ultima zi
            </label>
            <select
              id={idPortiuneSfarsit}
              value={portiuneSfarsit}
              onChange={(e) => {
                setPortiuneSfarsit(e.target.value as PortiuneZi);
              }}
              className={CLASA_CAMP}
            >
              {PORTIUNI.map((p) => (
                <option key={p} value={p}>
                  {ETICHETE_PORTIUNE[p]}
                </option>
              ))}
            </select>
          </div>
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
        <div>
          <label htmlFor={idVarianta} className="text-foreground text-corp font-medium">
            Variantă legală
          </label>
          <select
            id={idVarianta}
            value={variantaId}
            onChange={(e) => {
              setVariantaId(e.target.value);
            }}
            className={CLASA_CAMP}
          >
            <option value="">Varianta de bază</option>
            {varianteTip.map((varianta) => (
              <option key={varianta.id} value={varianta.id}>
                {varianta.denumire} — {formatAmount(varianta.zile)} zile
              </option>
            ))}
          </select>
          {variantaAleasa !== null && (
            <p aria-live="polite" className="text-muted-foreground text-corp mt-1">
              {variantaAleasa.conditie_descriere} Va trebui să atașezi documentul justificativ.
            </p>
          )}
        </div>
      )}

      {esteMedical && (
        <fieldset className="border-border bg-surface rounded-panou border p-4">
          <legend className="text-corp px-1 font-medium">Certificatul medical</legend>
          <p className="text-muted-foreground text-corp mb-3">
            Trece codul de pe certificatul primit de la medic. El decide procentul indemnizației și
            cine o suportă.
          </p>

          <div className="space-y-4">
            <div>
              <label htmlFor={idCodMedical} className="text-foreground text-corp font-medium">
                Cod de indemnizație
              </label>
              <select
                id={idCodMedical}
                value={medicalCodeId}
                onChange={(e) => {
                  setMedicalCodeId(e.target.value);
                }}
                required
                className={CLASA_CAMP}
              >
                <option value="">Alege codul de pe certificat…</option>
                {coduriMedicale.map((cod) => (
                  <option key={cod.id} value={cod.id}>
                    {cod.cod} — {cod.denumire} ({formatAmount(cod.procent)}%)
                  </option>
                ))}
              </select>
              {codAles !== null && (
                <p aria-live="polite" className="text-muted-foreground text-corp mt-1">
                  {formatAmount(codAles.procent)}% din baza de calcul,{" "}
                  {ETICHETE_PLATITOR[codAles.platitor]}
                  {codAles.zileAngajator > 0
                    ? ` — primele ${String(codAles.zileAngajator)} zile calendaristice.`
                    : "."}
                </p>
              )}
            </div>

            <div>
              <label htmlFor={idSerie} className="text-foreground text-corp font-medium">
                Seria <span className="text-muted-foreground font-normal">(opțional)</span>
              </label>
              <input
                id={idSerie}
                type="text"
                value={serieCertificat}
                maxLength={20}
                onChange={(e) => {
                  setSerieCertificat(e.target.value);
                }}
                className={CLASA_CAMP}
              />
            </div>

            <div>
              <label htmlFor={idNumar} className="text-foreground text-corp font-medium">
                Numărul certificatului
              </label>
              <input
                id={idNumar}
                type="text"
                value={numarCertificat}
                maxLength={30}
                required
                onChange={(e) => {
                  setNumarCertificat(e.target.value);
                }}
                className={CLASA_CAMP}
              />
            </div>
          </div>
        </fieldset>
      )}

      <div>
        <label htmlFor={idMotiv} className="text-foreground text-corp font-medium">
          Motiv <span className="text-muted-foreground font-normal">(opțional)</span>
        </label>
        <textarea
          id={idMotiv}
          value={motiv}
          rows={3}
          maxLength={500}
          onChange={(e) => {
            setMotiv(e.target.value);
          }}
          className={`${CLASA_CAMP} min-h-20`}
        />
      </div>

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

      {/* Mesaj persistent cu `aria-live`, nu notificare care dispare: pe telefon,
          un mesaj de trei secunde se pierde exact când omul se uită în altă parte. */}
      {eroare === null ? null : (
        <p
          role="alert"
          aria-live="assertive"
          className="border-danger/40 bg-danger/10 text-foreground rounded-control text-corp border p-3"
        >
          {eroare}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Buton
          varianta="primar"
          className="flex-1"
          disabled={tipuri.length === 0}
          inCurs={inCurs}
          textInCurs="Se trimite…"
          onClick={() => {
            trimiteFormular(true);
          }}
        >
          Trimite cererea
        </Buton>
        <Buton
          varianta="secundar"
          disabled={inCurs || tipuri.length === 0}
          onClick={() => {
            trimiteFormular(false);
          }}
        >
          Salvează ciornă
        </Buton>
      </div>
    </form>
  );
}
