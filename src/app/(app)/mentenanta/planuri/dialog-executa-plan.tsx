"use client";

import { Play } from "lucide-react";
import { useCallback, type ReactElement } from "react";

import { clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { VariantaButon } from "@/components/ui/buton";
import { observatiiCuPasi, rezumatPasi } from "@/domain/maintenance/instructiuni";
import type { TipMentenanta } from "@/schemas/maintenance";

import { inregistreazaInterventie } from "../actions";
import { CampuriInterventie, type OptiuneInterventie } from "../interventii/campuri-interventie";
import { valoriInterventie } from "../interventii/valori-interventie";

/**
 * „Execută” de pe un plan: intervenția legată de plan, pre-completată cu tipul
 * planului și ziua de azi. O intervenție REUȘITĂ mută scadența planului și îi
 * șterge amânarea (`ssm_intervention_apply`, 0183); una parțială sau eșuată
 * rămâne în registru, dar planul nu se mișcă — caseta o spune în descriere.
 *
 * Pașii din instrucțiuni apar ca bife; ce s-a bifat și ce nu intră în
 * `observatii`, înaintea textului omului (`observatiiCuPasi`).
 */
export function DialogExecutaPlan({
  planId,
  equipmentId,
  denumire,
  tip,
  pasi,
  angajati,
  azi,
  compact = false,
  laReusita,
}: Readonly<{
  planId: string;
  equipmentId: string;
  denumire: string;
  tip: TipMentenanta;
  /** Pașii din instrucțiuni (`pasiDinInstructiuni`), deja extrași pe server. */
  pasi: readonly string[];
  angajati: readonly OptiuneInterventie[];
  azi: string;
  /** Pe rândul din listă: buton terțiar, fără text lung. */
  compact?: boolean;
  laReusita?: () => void;
}>): ReactElement {
  const trimite = useCallback(
    async (formular: FormData) => {
      const valori = valoriInterventie(formular);
      const bifati = new Set<number>();
      pasi.forEach((_, i) => {
        if (formular.get(`pas_${String(i)}`) === "on") bifati.add(i);
      });
      return await inregistreazaInterventie({
        ...valori,
        observatii: observatiiCuPasi(rezumatPasi(pasi, bifati), valori.observatii),
        plan_id: planId,
        equipment_id: equipmentId,
      });
    },
    [pasi, planId, equipmentId],
  );

  const varianta: VariantaButon = compact ? "tertiar" : "primar";

  return (
    <FormularDialog
      declansator={{
        eticheta: "Execută",
        varianta,
        pictograma: <Play aria-hidden="true" className="size-4" />,
      }}
      titlu={`Execută „${denumire}”`}
      descriere="O intervenție reușită mută scadența planului la următorul termen și îi șterge amânarea. Una parțială sau eșuată rămâne în registru, dar planul nu se mișcă."
      marime="lucru"
      actiune={trimite}
      mesajReusita="Intervenția a fost înregistrată, iar planul și-a mutat scadența."
      etichetaTrimite="Salvează intervenția"
      textInCurs="Se salvează…"
      {...(laReusita === undefined ? {} : { laReusita })}
    >
      {(stare, idc) => (
        <div className="space-y-4">
          {pasi.length > 0 ? (
            <fieldset className="border-border rounded-panou border p-3">
              <legend className="text-corp px-1 font-medium">Lista de verificare</legend>
              <p className="text-muted-foreground text-nota mb-2">
                Bifați pașii făcuți. Lista intră în observațiile intervenției, cu ce a rămas
                nebifat.
              </p>
              <ul className="space-y-1.5">
                {pasi.map((pas, i) => {
                  const id = idc(`pas-${String(i)}`);
                  return (
                    <li key={id} className="flex items-start gap-2">
                      <input
                        id={id}
                        name={`pas_${String(i)}`}
                        type="checkbox"
                        className={`${clasaBifa} mt-0.5`}
                        defaultChecked={stare.valoriTrimise[`pas_${String(i)}`] === "on"}
                      />
                      <label htmlFor={id} className="text-corp">
                        {pas}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ) : null}
          <CampuriInterventie
            stare={stare}
            idc={idc}
            angajati={angajati}
            tipImplicit={tip}
            dataImplicita={azi}
          />
        </div>
      )}
    </FormularDialog>
  );
}
