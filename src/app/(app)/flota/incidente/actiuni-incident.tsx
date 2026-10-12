"use client";

import { ArrowRightLeft, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import {
  ETICHETE_STADIU_INCIDENT,
  stadiiUrmatoareIncident,
  type StadiuIncident,
} from "@/domain/fleet/amenzi";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { FormularDialog } from "@/components/ui/formular-dialog";
import { arataToast } from "@/components/ui/toast";

import { schimbaStadiulIncidentului, stergeIncident } from "../actions-amenzi";

type CampuriStadiu = Readonly<{
  asigurator: string | null;
  dosar_numar: string | null;
  despagubire: number | null;
}>;

/**
 * Schimbarea stadiului incidentului (0206). Câmpurile cerute de stadiul ales
 * apar lângă el: asigurătorul la „la asigurător”, costul final la „închis”
 * (închiderea îngheață incidentul). Cheile trimise sunt EXACT cele din
 * `schimbaStadiulIncidentuluiSchema`.
 */
function FormularStadiu({
  stadiuri,
  curent,
  stare,
  idc,
}: Readonly<{
  stadiuri: readonly StadiuIncident[];
  curent: CampuriStadiu;
  stare: Readonly<{
    erori: Readonly<Record<string, readonly string[]>>;
    valoriTrimise: Readonly<Record<string, string>>;
  }>;
  idc: (nume: string) => string;
}>): ReactElement {
  const [ales, setAles] = useState<StadiuIncident>(
    (stare.valoriTrimise["stadiu"] as StadiuIncident | undefined) ?? stadiuri[0] ?? "constatat",
  );
  const cereAsigurator = ales === "la_asigurator";
  const cereCost = ales === "inchis";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Camp
        nume="stadiu"
        id={idc("stadiu")}
        eticheta="Stadiul nou"
        fel="select"
        obligatoriu
        className="sm:col-span-2"
        erori={stare.erori["stadiu"] ?? []}
      >
        {(a) => (
          <select
            {...a}
            value={ales}
            onChange={(e) => {
              setAles(e.target.value as StadiuIncident);
            }}
          >
            {stadiuri.map((s) => (
              <option key={s} value={s}>
                {ETICHETE_STADIU_INCIDENT[s]}
              </option>
            ))}
          </select>
        )}
      </Camp>
      <Camp
        nume="asigurator"
        id={idc("asigurator")}
        eticheta="Asigurătorul"
        obligatoriu={cereAsigurator}
        erori={stare.erori["asigurator"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={200}
            defaultValue={stare.valoriTrimise["asigurator"] ?? curent.asigurator ?? ""}
          />
        )}
      </Camp>
      <Camp
        nume="dosar_numar"
        id={idc("dosar_numar")}
        eticheta="Numărul dosarului de daună"
        erori={stare.erori["dosar_numar"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={60}
            defaultValue={stare.valoriTrimise["dosar_numar"] ?? curent.dosar_numar ?? ""}
          />
        )}
      </Camp>
      <Camp
        nume="cost_final"
        id={idc("cost_final")}
        eticheta="Costul final (lei)"
        obligatoriu={cereCost}
        {...(cereCost
          ? {
              ajutor:
                "0 dacă n-a fost nimic de plătit. După închidere, incidentul nu se mai modifică.",
            }
          : {})}
        erori={stare.erori["cost_final"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={stare.valoriTrimise["cost_final"] ?? ""}
          />
        )}
      </Camp>
      <Camp
        nume="despagubire"
        id={idc("despagubire")}
        eticheta="Despăgubirea primită (lei)"
        erori={stare.erori["despagubire"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={
              stare.valoriTrimise["despagubire"] ??
              (curent.despagubire === null ? "" : String(curent.despagubire))
            }
          />
        )}
      </Camp>
    </div>
  );
}

export function DialogStadiuIncident({
  incidentId,
  stadiu,
  asigurator,
  dosarNumar,
  despagubire,
}: Readonly<{
  incidentId: string;
  stadiu: StadiuIncident;
  asigurator: string | null;
  dosarNumar: string | null;
  despagubire: number | null;
}>): ReactElement | null {
  const stadiuri = stadiiUrmatoareIncident(stadiu);
  if (stadiuri.length === 0) return null;

  async function trimite(date: FormData) {
    return schimbaStadiulIncidentului({
      id: incidentId,
      stadiu: String(date.get("stadiu") ?? ""),
      asigurator: String(date.get("asigurator") ?? ""),
      dosar_numar: String(date.get("dosar_numar") ?? ""),
      cost_final: String(date.get("cost_final") ?? ""),
      despagubire: String(date.get("despagubire") ?? ""),
    });
  }

  return (
    <FormularDialog
      declansator={{
        eticheta: "Schimbă stadiul",
        varianta: "primar",
        pictograma: <ArrowRightLeft aria-hidden="true" className="size-4" />,
      }}
      titlu="Stadiul incidentului"
      descriere="Puteți merge în orice stadiu deschis, inclusiv înapoi, ca să corectați o greșeală. „Închis” e definitiv: cere costul final și îngheață incidentul."
      actiune={trimite}
      mesajReusita="Stadiul a fost schimbat."
      etichetaTrimite="Schimbă stadiul"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <FormularStadiu
          stadiuri={stadiuri}
          curent={{ asigurator, dosar_numar: dosarNumar, despagubire }}
          stare={stare}
          idc={idc}
        />
      )}
    </FormularDialog>
  );
}

/** Ștergerea unui incident doar raportat (introdus din greșeală). */
export function ButonStergeIncident({
  incidentId,
}: Readonly<{ incidentId: string }>): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergeIncident({ id: incidentId });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: "Incidentul a fost șters." });
      router.push("/flota/incidente");
    });
  }

  return (
    <>
      <Buton
        varianta="distructiv"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
        Șterge
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Ștergeți incidentul?"
        consecinta="Ștergeți doar un incident introdus din greșeală, încă netrecut prin vreun stadiu. Unul aflat în lucru se închide, cu costul final."
        etichetaConfirmare="Șterge incidentul"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
