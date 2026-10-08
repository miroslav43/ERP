"use client";

import { Pause, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";

import { FormularPlan, type PlanExistent } from "../../echipamente/[id]/formular-plan";
import type { OptiuneInterventie } from "../../interventii/campuri-interventie";
import { comutaPlanActiv, stergePlan } from "../actions";
import { DialogAmanaPlan } from "../dialog-amana-plan";
import { DialogExecutaPlan } from "../dialog-executa-plan";

/**
 * Bara de acțiuni a fișei planului: Execută, Amână, Editează, Activ/Inactiv,
 * Șterge. Toate pe `maintenance:update`/team — pagina n-o randează fără.
 *
 * Fiecare gest spune consecința în caseta lui, nu „Sigur?”: dezactivarea
 * scoate planul din scadențe și din alertele zilnice; ștergerea e logică, dar
 * intervențiile legate rămân în registru cu planul lor — cifra apare în casetă,
 * ca omul să știe ce lasă în urmă.
 */
export function ActiuniPlan({
  plan,
  pasi,
  angajati,
  azi,
  numarInterventii,
}: Readonly<{
  plan: PlanExistent;
  pasi: readonly string[];
  angajati: readonly OptiuneInterventie[];
  azi: string;
  numarInterventii: number;
}>): ReactElement {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {plan.activ ? (
        <DialogExecutaPlan
          planId={plan.id}
          equipmentId={plan.equipment_id}
          denumire={plan.denumire}
          tip={plan.tip}
          pasi={pasi}
          angajati={angajati}
          azi={azi}
        />
      ) : null}
      {plan.activ && plan.periodicitate_zile !== null ? (
        <DialogAmanaPlan
          planId={plan.id}
          denumire={plan.denumire}
          scadentaCurenta={plan.urmatoarea_scadenta}
          numarAmanari={plan.numar_amanari}
          azi={azi}
        />
      ) : null}
      <FormularPlan equipmentId={plan.equipment_id} angajati={angajati} planExistent={plan} />
      <ButonConfirmare
        eticheta={plan.activ ? "Dezactivează" : "Activează"}
        pictograma={
          plan.activ ? (
            <Pause aria-hidden="true" className="size-4" />
          ) : (
            <Play aria-hidden="true" className="size-4" />
          )
        }
        titlu={plan.activ ? "Dezactivați planul?" : "Activați planul?"}
        consecinta={
          plan.activ
            ? "Planul dispare din scadențe și din alertele zilnice, dar rămâne pe fișa echipamentului și poate fi reactivat oricând."
            : "Planul reintră în scadențe și în alertele zilnice, de la scadența lui curentă."
        }
        etichetaConfirmare={plan.activ ? "Dezactivează planul" : "Activează planul"}
        executa={() => comutaPlanActiv({ id: plan.id, activ: !plan.activ })}
        mesajReusita={plan.activ ? "Planul a fost dezactivat." : "Planul a fost activat."}
      />
      <ButonConfirmare
        eticheta="Șterge"
        varianta="distructiv"
        distructiv
        pictograma={<Trash2 aria-hidden="true" className="size-4" />}
        titlu="Ștergeți planul?"
        consecinta="Planul iese din scadențe și din liste. Intervențiile deja înregistrate rămân în registru, legate de el."
        cifre={[{ eticheta: "Intervenții înregistrate", valoare: String(numarInterventii) }]}
        etichetaConfirmare="Șterge planul"
        executa={() => stergePlan({ id: plan.id })}
        mesajReusita="Planul a fost șters."
        dupaReusita={() => {
          router.push("/mentenanta/planuri");
        }}
      />
    </div>
  );
}

function ButonConfirmare({
  eticheta,
  pictograma,
  varianta = "secundar",
  titlu,
  consecinta,
  cifre,
  etichetaConfirmare,
  distructiv = false,
  executa,
  mesajReusita,
  dupaReusita,
}: {
  readonly eticheta: string;
  readonly pictograma: ReactElement;
  readonly varianta?: "primar" | "secundar" | "distructiv";
  readonly titlu: string;
  readonly consecinta: string;
  readonly cifre?: readonly Readonly<{ eticheta: string; valoare: string }>[];
  readonly etichetaConfirmare: string;
  readonly distructiv?: boolean;
  readonly executa: () => Promise<ActionResult<unknown>>;
  readonly mesajReusita: string;
  /** După reușită, în locul lui `router.refresh()` — ex. plecarea de pe o fișă ștearsă. */
  readonly dupaReusita?: () => void;
}): ReactElement {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();

  function confirma(): void {
    porneste(async () => {
      const rezultat = await executa();
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: mesajReusita });
      if (dupaReusita === undefined) router.refresh();
      else dupaReusita();
    });
  }

  return (
    <>
      <Buton
        varianta={varianta}
        onClick={() => {
          setDeschis(true);
        }}
      >
        {pictograma}
        {eticheta}
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={titlu}
        consecinta={consecinta}
        {...(cifre === undefined ? {} : { cifre })}
        etichetaConfirmare={etichetaConfirmare}
        distructiv={distructiv}
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
