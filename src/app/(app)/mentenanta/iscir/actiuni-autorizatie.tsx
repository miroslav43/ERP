"use client";

import { Ban, CirclePlay, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";

import {
  actualizeazaAutorizatie,
  reactiveazaAutorizatie,
  reinnoiesteAutorizatie,
  stergeAutorizatie,
  suspendaAutorizatie,
} from "./actions";
import { CampuriAutorizatie } from "./campuri-autorizatie";
import { valoriAutorizatie, valoriReinnoire } from "./valori-autorizatie";

/**
 * Gesturile de pe o autorizație ISCIR CURENTĂ (M7, 0211): Corectează,
 * Reînnoiește, Suspendă / Ridică suspendarea, Șterge. Fișa echipamentului nu
 * le randează fără `maintenance:update`/team și nici pe un rând înlocuit
 * (istoric: garda din bază l-ar refuza oricum).
 *
 * Nimic de aici nu blochează utilajul (cazul 38): suspendarea doar scoate
 * autorizația din scadențe și o arată roșu.
 *
 * Confirmările spun consecința, nu „Sigur?”: ștergerea unei REÎNNOIRI readuce
 * autorizația anterioară în scadențe — „am reînnoit greșit” se repară așa.
 */
export function ActiuniAutorizatie({
  id,
  eticheta,
  suspendata,
  esteReinnoire,
  existenta,
  azi,
}: Readonly<{
  id: string;
  /** „Macara · ISCIR-77” — titlurile casetelor o numesc. */
  eticheta: string;
  suspendata: boolean;
  /** Rândul a înlocuit altul prin reînnoire — ștergerea lui îl readuce pe acela. */
  esteReinnoire: boolean;
  /** Valorile curente, ca text (forma din `FormData`). */
  existenta: Readonly<Record<string, string>>;
  azi: string;
}>): ReactElement {
  const router = useRouter();
  const [confirmare, setConfirmare] = useState<"sterge" | "reactiveaza" | null>(null);
  const [inCurs, porneste] = useTransition();

  const corecteaza = useCallback(
    async (formular: FormData) =>
      await actualizeazaAutorizatie({ ...valoriAutorizatie(formular), id }),
    [id],
  );
  const reinnoieste = useCallback(
    async (formular: FormData) =>
      await reinnoiesteAutorizatie({ ...valoriReinnoire(formular), id }),
    [id],
  );
  const suspenda = useCallback(
    async (formular: FormData) =>
      await suspendaAutorizatie({
        id,
        suspendata_la: String(formular.get("suspendata_la") ?? "").trim(),
        motiv_suspendare: String(formular.get("motiv_suspendare") ?? ""),
      }),
    [id],
  );

  function confirma(): void {
    const gest = confirmare;
    if (gest === null) return;
    porneste(async () => {
      const rezultat =
        gest === "sterge" ? await stergeAutorizatie({ id }) : await reactiveazaAutorizatie({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setConfirmare(null);
      arataToast({
        fel: "reusita",
        text:
          gest === "sterge"
            ? "Autorizația a fost ștearsă."
            : "Suspendarea a fost ridicată; autorizația revine în scadențe.",
      });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FormularDialog
        declansator={{
          eticheta: "Corectează",
          varianta: "secundar",
          pictograma: <Pencil aria-hidden="true" className="size-4" />,
        }}
        titlu={`Corectați autorizația ${eticheta}`}
        descriere="Pentru o greșeală de scriere. Un document nou (o verificare făcută, o autorizație prelungită) se înregistrează cu „Reînnoiește”, ca istoricul să rămână."
        marime="mare"
        actiune={corecteaza}
        mesajReusita="Autorizația a fost corectată."
        etichetaTrimite="Salvează corectura"
        textInCurs="Se salvează…"
      >
        {(stare, idc) => <CampuriAutorizatie stare={stare} idc={idc} existenta={existenta} />}
      </FormularDialog>

      <FormularDialog
        declansator={{
          eticheta: "Reînnoiește",
          varianta: "secundar",
          pictograma: <RefreshCw aria-hidden="true" className="size-4" />,
        }}
        titlu={`Reînnoiți autorizația ${eticheta}`}
        descriere="Se înregistrează o autorizație nouă, cu datele de pe documentul primit. Cea de acum rămâne în istoric și iese din scadențe. Scadența din document are prioritate față de orice calcul."
        marime="mare"
        actiune={reinnoieste}
        mesajReusita="Autorizația a fost reînnoită."
        etichetaTrimite="Salvează reînnoirea"
        textInCurs="Se salvează…"
      >
        {(stare, idc) => {
          const trimise: Readonly<Record<string, string>> =
            stare.data === null ? stare.valoriTrimise : {};
          return (
            <div className="grid gap-3 sm:grid-cols-2">
              <Camp
                nume="numar"
                id={idc("numar")}
                eticheta="Număr de înregistrare ISCIR"
                ajutor="Poate rămâne același: numărul de înregistrare al echipamentului nu se schimbă la fiecare verificare. Gol doar în evidența RSVTI."
                erori={stare.erori["numar"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    maxLength={80}
                    defaultValue={trimise["numar"] ?? existenta["numar"] ?? ""}
                  />
                )}
              </Camp>
              <Camp
                nume="emitent"
                id={idc("emitent")}
                eticheta="Emitent"
                erori={stare.erori["emitent"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    maxLength={120}
                    defaultValue={trimise["emitent"] ?? existenta["emitent"] ?? "ISCIR"}
                  />
                )}
              </Camp>
              <Camp
                nume="emis_la"
                id={idc("emis-la")}
                eticheta="Emisă la"
                erori={stare.erori["emis_la"] ?? []}
              >
                {(a) => <input {...a} type="date" defaultValue={trimise["emis_la"] ?? azi} />}
              </Camp>
              <Camp
                nume="valabil_pana"
                id={idc("valabil-pana")}
                eticheta="Valabilă până la"
                obligatoriu
                erori={stare.erori["valabil_pana"] ?? []}
              >
                {(a) => <input {...a} type="date" defaultValue={trimise["valabil_pana"] ?? ""} />}
              </Camp>
              <Camp
                nume="scadenta_verificare_tehnica"
                id={idc("scadenta-verificare")}
                eticheta="Următoarea verificare tehnică (VTP)"
                erori={stare.erori["scadenta_verificare_tehnica"] ?? []}
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    defaultValue={trimise["scadenta_verificare_tehnica"] ?? ""}
                  />
                )}
              </Camp>
              <Camp
                nume="conditii"
                id={idc("conditii")}
                eticheta="Condiții impuse"
                fel="textarea"
                className="sm:col-span-2"
                erori={stare.erori["conditii"] ?? []}
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={2}
                    maxLength={1000}
                    defaultValue={trimise["conditii"] ?? ""}
                  />
                )}
              </Camp>
            </div>
          );
        }}
      </FormularDialog>

      {suspendata ? (
        <Buton
          varianta="secundar"
          onClick={() => {
            setConfirmare("reactiveaza");
          }}
        >
          <CirclePlay aria-hidden="true" className="size-4" />
          Ridică suspendarea
        </Buton>
      ) : (
        <FormularDialog
          declansator={{
            eticheta: "Suspendă",
            varianta: "secundar",
            pictograma: <Ban aria-hidden="true" className="size-4" />,
          }}
          titlu={`Suspendați autorizația ${eticheta}`}
          descriere="Autorizația iese din scadențe și apare roșu pe fișă și în lista ISCIR. Aplicația nu oprește utilajul: oprirea se face în hală."
          marime="mediu"
          actiune={suspenda}
          mesajReusita="Autorizația a fost suspendată."
          etichetaTrimite="Suspendă autorizația"
          variantaTrimite="distructiv"
          textInCurs="Se suspendă…"
        >
          {(stare, idc) => {
            const trimise: Readonly<Record<string, string>> =
              stare.data === null ? stare.valoriTrimise : {};
            return (
              <div className="grid gap-3">
                <Camp
                  nume="suspendata_la"
                  id={idc("suspendata-la")}
                  eticheta="Suspendată la"
                  obligatoriu
                  erori={stare.erori["suspendata_la"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="date"
                      max={azi}
                      defaultValue={trimise["suspendata_la"] ?? azi}
                    />
                  )}
                </Camp>
                <Camp
                  nume="motiv_suspendare"
                  id={idc("motiv")}
                  eticheta="Motivul suspendării"
                  fel="textarea"
                  obligatoriu
                  ajutor="Cel puțin 5 caractere. Ex. „PV ISCIR nr. 123: frâna de ridicare necorespunzătoare”."
                  erori={stare.erori["motiv_suspendare"] ?? []}
                >
                  {(a) => (
                    <textarea
                      {...a}
                      rows={3}
                      maxLength={1000}
                      defaultValue={trimise["motiv_suspendare"] ?? ""}
                    />
                  )}
                </Camp>
              </div>
            );
          }}
        </FormularDialog>
      )}

      <Buton
        varianta="distructiv"
        onClick={() => {
          setConfirmare("sterge");
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
        Șterge
      </Buton>

      <ConfirmareActiune
        deschis={confirmare === "sterge"}
        laInchidere={() => {
          setConfirmare(null);
        }}
        titlu={`Ștergeți autorizația ${eticheta}?`}
        consecinta={
          esteReinnoire
            ? "Reînnoirea se anulează: autorizația anterioară revine în scadențe, cu termenele ei. Rândul din registrul de documente rămâne."
            : "Autorizația iese din liste și din scadențe. Rândul din registrul de documente rămâne, ca orice document înregistrat."
        }
        etichetaConfirmare="Șterge autorizația"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
      <ConfirmareActiune
        deschis={confirmare === "reactiveaza"}
        laInchidere={() => {
          setConfirmare(null);
        }}
        titlu={`Ridicați suspendarea autorizației ${eticheta}?`}
        consecinta="Autorizația revine în scadențe și în alertele zilnice. Motivul ultimei suspendări rămâne pe fișă, ca istoric."
        etichetaConfirmare="Ridică suspendarea"
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </div>
  );
}
