"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { OptiunePlan } from "@/lib/queries/maintenance";

import { inregistreazaInterventie } from "../actions";
import { CampuriInterventie, type OptiuneInterventie } from "./campuri-interventie";
import { useDocumentInterventie } from "./document-interventie";
import { valoriInterventie } from "./valori-interventie";

/**
 * „Intervenție nouă” din lista de intervenții (M6), în casetă — tiparul
 * `?vehicul=nou` din Flotă: `?interventie=noua` o deschide la montare.
 *
 * Spre deosebire de fișa echipamentului, aici echipamentul se ALEGE, iar
 * planurile oferite sunt doar ale lui (selectoare controlate, în afara lui
 * `CampuriInterventie`). Alegerea planului repornește câmpurile intervenției cu
 * tipul planului — de aceea utilajul și planul stau primele în casetă. Un plan
 * de verificare legală face documentul obligatoriu.
 */
export function DialogInterventieNoua({
  deschisInitial = false,
  echipamente,
  planuri,
  angajati,
  azi,
}: Readonly<{
  deschisInitial?: boolean;
  echipamente: readonly OptiuneInterventie[];
  planuri: readonly OptiunePlan[];
  angajati: readonly OptiuneInterventie[];
  azi: string;
}>): ReactElement {
  const router = useRouter();
  const [echipament, setEchipament] = useState("");
  const [plan, setPlan] = useState("");
  const { pregateste, uita } = useDocumentInterventie();

  const aleEchipamentului = planuri.filter((p) => p.equipment_id === echipament);
  const planAles = aleEchipamentului.find((p) => p.id === plan) ?? null;

  const trimite = useCallback(
    async (formular: FormData) => {
      const document = await pregateste(formular);
      if (!document.ok) return document.rezultat;
      const ales = String(formular.get("equipment_id") ?? "");
      const planFormular = String(formular.get("plan_id") ?? "");
      const rezultat = await inregistreazaInterventie({
        ...valoriInterventie(formular),
        id: document.id,
        atasament: document.atasament,
        equipment_id: ales,
        plan_id: planFormular.length === 0 ? null : planFormular,
      });
      if (rezultat.ok) uita();
      return rezultat;
    },
    [pregateste, uita],
  );

  return (
    <FormularDialog
      declansator={{
        eticheta: "Intervenție nouă",
        varianta: "primar",
        pictograma: <Plus aria-hidden="true" className="size-4" />,
      }}
      titlu="Intervenție de mentenanță"
      descriere="Legată de un plan, o intervenție reușită îi mută scadența. Fără plan, rămâne o intervenție de sine stătătoare — o reparație neplanificată, de pildă."
      marime="lucru"
      deschisInitial={deschisInitial}
      actiune={trimite}
      mesajReusita="Intervenția a fost înregistrată."
      etichetaTrimite="Salvează intervenția"
      textInCurs="Se salvează…"
      laReusita={(data) => {
        router.push(`/mentenanta/interventii/${data.id}`);
      }}
      laResetare={() => {
        setEchipament("");
        setPlan("");
      }}
    >
      {(stare, idc) => (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Camp
              nume="equipment_id"
              id={idc("echipament")}
              eticheta="Echipament"
              obligatoriu
              fel="select"
              erori={stare.erori["equipment_id"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  value={echipament}
                  onChange={(e) => {
                    setEchipament(e.target.value);
                    setPlan("");
                  }}
                >
                  <option value="">Alegeți echipamentul</option>
                  {echipamente.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nume}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
            <Camp
              nume="plan_id"
              id={idc("plan")}
              eticheta="Din planul"
              fel="select"
              {...(echipament === "" ? { ajutor: "Alegeți întâi echipamentul." } : {})}
              erori={stare.erori["plan_id"] ?? []}
            >
              {(a) => (
                <select
                  {...a}
                  value={plan}
                  disabled={echipament === ""}
                  onChange={(e) => {
                    setPlan(e.target.value);
                  }}
                >
                  <option value="">Fără plan (intervenție de sine stătătoare)</option>
                  {aleEchipamentului.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nume}
                    </option>
                  ))}
                </select>
              )}
            </Camp>
          </div>
          <CampuriInterventie
            // Tipul planului devine implicit la alegere: `key` remontează
            // câmpurile intervenției, nu și selectoarele de mai sus.
            key={planAles?.id ?? "fara-plan"}
            stare={stare}
            idc={idc}
            angajati={angajati}
            tipImplicit={planAles?.tip ?? "corectiva"}
            dataImplicita={azi}
            document={{ obligatoriu: planAles?.tip === "verificare_legala" }}
          />
        </div>
      )}
    </FormularDialog>
  );
}
