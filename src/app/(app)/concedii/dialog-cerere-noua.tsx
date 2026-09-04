// src/app/(app)/concedii/dialog-cerere-noua.tsx
"use client";

import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Dialog } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";
import { IntrareData } from "@/components/ui/intrare-data";
import { arataToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";
import { numaraZileCerere } from "@/domain/leave/zile-cerere";
import { tipImplicitConcediu } from "@/domain/leave/tip-implicit";
import { formatAmount } from "@/lib/format/money";

import { IncarcareDocumentConcediu } from "./incarcare-document";
import { creeazaCerereConcediu } from "./actions";

/**
 * Cererea de concediu nouă, într-o CASETĂ deschisă din lista de cereri.
 *
 * ── DE CE NU MAI E O PAGINĂ ────────────────────────────────────────────────
 * `/concedii/noua` era o rută proprie, iar deschiderea ei costa un drum
 * complet la server: `requireTenant` (două apeluri GoTrue), `requireFeature`,
 * `getPermissionMap`, apoi două valuri de interogări în serie — tipuri,
 * sărbători, coduri de indemnizație, variante, sold. Pentru un formular pe
 * care omul îl completează în treizeci de secunde, așteptarea de dinaintea
 * primului câmp era jumătate din interacțiune.
 *
 * Datele vin acum odată cu lista (`date-cerere-noua.ts`, în același
 * `Promise.all` cu restul paginii), iar deschiderea casetei nu mai atinge
 * rețeaua deloc.
 *
 * ── CELE DOUĂ CAPCANE DE CASETĂ ────────────────────────────────────────────
 * Aceleași ca în `components/ui/formular-dialog.tsx`, de unde tiparul e
 * împrumutat — dar componenta aceea nu se poate folosi aici, fiindcă are UN
 * singur buton de trimitere, iar cererea are două („ciornă" și „spre
 * aprobare"), cu aceeași acțiune.
 *
 * 1. Butoanele stau ÎN `<form>`, într-un `BaraActiuni`, nu în `subsol`-ul
 *    dialogului: `subsol` e FRATE cu formularul în DOM, deci un buton pus
 *    acolo n-ar putea nici să trimită, nici să citească `stare.inCurs`.
 * 2. Conținutul se RANDEAZĂ la deschidere, nu se ascunde — de aceea câmpurile
 *    stau într-o componentă separată, montată abia când caseta e deschisă. Cu
 *    starea ținută aici sus, o a doua deschidere ar reveni cu ce rămăsese
 *    scris de prima dată.
 *
 * Caseta NU se închide la refuz: doar `laReusita` o închide. Cu câmpuri
 * necontrolate, React 19 resetează formularul după acțiune — inclusiv când a
 * eșuat — iar `Formular` repară asta prin `valoriTrimise`; închiderea pe
 * eroare ar arunca exact ce a scris omul.
 */

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

export interface DateCerereNoua {
  readonly tipuri: readonly TipConcediu[];
  readonly coduriMedicale: readonly CodMedical[];
  readonly variante: readonly VariantaConcediu[];
  readonly sarbatoriRo: readonly string[];
  readonly liberSuplimentar: readonly string[];
  readonly zileRecuperare: readonly string[];
  /** `null` = cine se uită nu poate cere pentru altcineva (`leave:create` sub „all"). */
  readonly angajati: readonly Angajat[] | null;
  /** Zile rămase pe tip, doar când cererea e strict proprie. */
  readonly soldPropriu: Readonly<Record<string, number>> | null;
  /**
   * Cine se uită are `leave:approve = all`, deci cererea pe care o depune se
   * aprobă pe loc (v. `aprobaPeLoc` din `actions.ts`).
   *
   * Se calculează pe SERVER și ajunge aici ca proprietate, nu se deduce din
   * rezultatul acțiunii: butonul trebuie să spună ce face ÎNAINTE de apăsare.
   * „Trimite spre aprobare" pe un buton care aprobă instantaneu e o minciună
   * mică, dar exact felul de minciună după care oamenii încetează să citească
   * butoanele.
   */
  readonly poateAprobaPeLoc: boolean;
}

const ETICHETE_PLATITOR: Readonly<Record<CodMedical["platitor"], string>> = {
  angajator: "suportat integral de firmă",
  fnuass: "suportat integral de FNUASS",
  mixt: "primele zile de firmă, restul de la FNUASS",
};

type CerereCreata = Readonly<{
  id: string;
  /** Cererea a sărit lanțul de aprobare — a scris-o cineva cu `leave:approve = all`. */
  aprobataInstant: boolean;
  /**
   * Zile de concediu peste care exista deja o linie de pontaj scrisă de om.
   * Nu se aruncă: ziua rămâne „lucrată" ȘI scade din sold, deci se plătește de
   * două ori dacă nimeni nu se uită. Ecranul e singurul loc unde ajunge la
   * cineva care poate repara.
   */
  zilePastrate: number;
  /**
   * Ce a rămas de făcut pentru declararea suspendării contractului, când tipul
   * de concediu o produce. `motiv` non-null înseamnă că declararea a eșuat și
   * trebuie făcută de mână, în termenul legal.
   */
  suspendare: Readonly<{
    ceruta: boolean;
    declarata: boolean;
    termen: string | null;
    motiv: string | null;
  }>;
}>;

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

export function DialogCerereNoua({
  date,
  deschisInitial = false,
}: {
  readonly date: DateCerereNoua;
  /**
   * `/concedii?cerere=noua` deschide caseta din prima randare — adresa pe care
   * o folosesc butonul din panou și starea goală a listei, ca „Cerere nouă" să
   * ducă tot la formular, nu doar la ecranul de unde se deschide.
   *
   * Pagina remontează componenta la schimbarea parametrului (vezi `key`-ul din
   * `page.tsx`): fără asta, o navigare pe ACEEAȘI rută ar păstra starea
   * clientului, iar `useState` ar ignora valoarea inițială nouă.
   */
  readonly deschisInitial?: boolean;
}) {
  const [deschis, setDeschis] = useState(deschisInitial);

  const inchide = useCallback((): void => {
    setDeschis(false);
  }, []);

  return (
    <>
      <Buton
        varianta="primar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <CalendarPlus aria-hidden="true" className="size-4" />
        Cerere nouă
      </Buton>

      {deschis ? (
        <Dialog
          deschis
          laInchidere={inchide}
          titlu="Cerere de concediu nouă"
          descriere="Zilele consumate se numără pe măsură ce completați; soldul se verifică din nou, exact, la trimitere."
          marime="mare"
        >
          <FormularCerereNoua date={date} laInchidere={inchide} />
        </Dialog>
      ) : null}
    </>
  );
}

function FormularCerereNoua({
  date: {
    tipuri,
    coduriMedicale,
    variante,
    sarbatoriRo,
    liberSuplimentar,
    zileRecuperare,
    angajati,
    soldPropriu,
    poateAprobaPeLoc,
  },
  laInchidere,
}: {
  readonly date: DateCerereNoua;
  readonly laInchidere: () => void;
}) {
  const router = useRouter();
  const idFormular = useId();
  const idc = useCallback((sufix: string): string => `${idFormular}-${sufix}`, [idFormular]);

  // Controlate rămân doar câmpurile care hrănesc previzualizarea sau deschid
  // alte câmpuri; starea lor supraviețuiește oricum unei erori de validare.
  // Restul sunt necontrolate și își reiau valoarea din `stare.valoriTrimise`.
  const [leaveTypeId, setLeaveTypeId] = useState(tipImplicitConcediu(tipuri)?.id ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [dataInceput, setDataInceput] = useState("");
  const [dataSfarsit, setDataSfarsit] = useState("");
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
        sarbatoriRo,
        liberSuplimentar,
        zileRecuperare,
      );
    } catch {
      return null;
    }
  }, [dataInceput, dataSfarsit, sarbatoriRo, liberSuplimentar, zileRecuperare]);

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
   * `data_sfarsit`, `motiv`, `atasament_path`, `leave_variant_id`,
   * `medical_code_id`, `serie_certificat`, `numar_certificat`. Fără potrivirea
   * asta, `fieldErrors` întors de acțiune n-ar mai găsi niciun câmp, iar
   * mesajul ar dispărea în tăcere.
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
      motiv: textSauNull(date, "motiv"),
      atasament_path: textSauNull(date, "atasament_path"),
      leave_variant_id: textSauNull(date, "leave_variant_id"),
      medical_code_id: codMedical,
      serie_certificat: textSauNull(date, "serie_certificat"),
      numar_certificat: numarCertificat,
      trimite: trimiteSpreAprobare.current,
    });
  }

  /**
   * După reușită se închide caseta și se reîmprospătează LISTA, în locul unui
   * `router.push` către fișa cererii. Formularul a devenit casetă tocmai
   * fiindcă drumurile la server se simțeau; a-l încheia cu încă o navigare ar
   * fi mutat aceeași așteptare de la început la sfârșit. Cererea apare în
   * rândul de sus al listei, cu starea ei, iar notificarea spune ce s-a
   * întâmplat — cine vrea fișa o deschide de acolo.
   *
   * Stabil prin `useCallback`: `laReusita` intră în dependențele efectului din
   * `Formular`, iar o funcție nouă la fiecare randare ar reporni efectul după
   * succes, adică ar afișa notificarea de două ori.
   */
  const laReusita = useCallback(
    (data: CerereCreata): void => {
      /*
       * Zilele păstrate NU se pot pierde aici.
       *
       * Cererea aprobată pe loc intră imediat în pontaj, iar sincronizarea sare
       * peste zilele pe care angajatul și le-a pontat singur. Ele rămân
       * „lucrate" ȘI scad din soldul de concediu — adică se plătesc de două
       * ori. Aceeași notificare o dă și ecranul de aprobări (`DecizieAprobare`);
       * pe drumul ăsta nu exista niciun aprobator care s-o vadă.
       *
       * `fel: "eroare"`, nu „reușită": notificările de reușită se sting singure
       * după șase secunde, erorile nu. Numărul ăsta trebuie citit.
       */
      if (data.zilePastrate > 0) {
        arataToast({
          fel: "eroare",
          text: `Atenție: ${String(data.zilePastrate)} ${
            data.zilePastrate === 1
              ? "zi de concediu era deja pontată ca lucrată și a rămas așa"
              : "zile de concediu erau deja pontate ca lucrate și au rămas așa"
          }. Verificați-le în pontaj — altfel se plătesc de două ori.`,
        });
      }
      /*
       * Aprobarea pe loc declară singură suspendarea contractului, pentru
       * tipurile care o produc. Termenul e ziua anterioară începerii, iar
       * ratarea lui e contravenție per salariat — deci și reușita se spune, nu
       * doar eșecul: altfel nimeni nu știe că mai există un eveniment de
       * transmis din REGES.
       */
      if (data.suspendare.motiv !== null) {
        arataToast({ fel: "eroare", text: data.suspendare.motiv });
      } else if (data.suspendare.declarata && data.suspendare.termen !== null) {
        arataToast({
          fel: "eroare",
          text: `Concediul suspendă contractul de muncă. Suspendarea a fost înregistrată, iar evenimentul de transmis în REGES este pregătit — termenul este ${data.suspendare.termen}.`,
        });
      }
      laInchidere();
      router.refresh();
    },
    [laInchidere, router],
  );

  return (
    <Formular
      actiune={trimiteCererea}
      laReusita={laReusita}
      mesajReusita={
        intentia === "ciorna"
          ? "Cererea a fost salvată ca ciornă."
          : poateAprobaPeLoc
            ? "Cererea a fost înregistrată și aprobată."
            : "Cererea a fost trimisă spre aprobare."
      }
      className="gap-6"
    >
      {(stare) => (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {angajati !== null ? (
              <Camp
                nume="employee_id"
                id={idc("employee_id")}
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
              id={idc("leave_type_id")}
              eticheta="Tip de concediu"
              fel="select"
              className="sm:col-span-2"
              erori={stare.erori["leave_type_id"] ?? []}
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
              id={idc("data_inceput")}
              eticheta="Data de început"
              obligatoriu
              erori={stare.erori["data_inceput"] ?? []}
            >
              {(a) => (
                <IntrareData
                  {...a}
                  valoare={dataInceput}
                  onSchimba={(zi) => {
                    setDataInceput(zi);
                    // Un interval de o zi e cazul cel mai des întâlnit.
                    if (dataSfarsit.length === 0) setDataSfarsit(zi);
                  }}
                />
              )}
            </Camp>

            <Camp
              nume="data_sfarsit"
              id={idc("data_sfarsit")}
              eticheta="Data de sfârșit"
              obligatoriu
              erori={stare.erori["data_sfarsit"] ?? []}
            >
              {(a) => (
                <IntrareData
                  {...a}
                  valoare={dataSfarsit}
                  {...(dataInceput.length > 0 ? { min: dataInceput } : {})}
                  onSchimba={(zi) => {
                    setDataSfarsit(zi);
                  }}
                />
              )}
            </Camp>

            <Camp
              nume="motiv"
              id={idc("motiv")}
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
                id={idc("leave_variant_id")}
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
                    id={idc("medical_code_id")}
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
                    id={idc("serie_certificat")}
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
                    id={idc("numar_certificat")}
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

            <IncarcareDocumentConcediu
              cheieTip={tip?.key ?? null}
              necesitaDocument={tip?.necesita_document ?? false}
              employeeId={employeeId.length === 0 ? null : employeeId}
              erori={stare.erori["atasament_path"] ?? []}
            />
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

          <BaraActiuni aliniere="final" separata lipitaPeTelefon>
            <Buton varianta="secundar" onClick={laInchidere} disabled={stare.inCurs}>
              Renunță
            </Buton>
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
              textInCurs={poateAprobaPeLoc ? "Se înregistrează…" : "Se trimite…"}
              onClick={() => {
                trimiteSpreAprobare.current = true;
                setIntentia("trimitere");
              }}
            >
              {/* Butonul spune ce face. Pentru cine are `leave:approve = all`,
                  cererea nu pleacă nicăieri: se aprobă pe loc. */}
              {poateAprobaPeLoc ? "Înregistrează și aprobă" : "Trimite spre aprobare"}
            </Buton>
          </BaraActiuni>
        </>
      )}
    </Formular>
  );
}
