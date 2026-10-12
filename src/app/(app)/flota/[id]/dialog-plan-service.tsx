"use client";

import { ListChecks, Pencil } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Camp, clasaBifa } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { StareFormular } from "@/components/ui/formular";
import { scadentaPlan, ultimaEfectiva, urmatoareaScadenta } from "@/domain/fleet/service";
import type { PlanService } from "@/lib/queries/fleet-service";
import { TIPURI_SERVICE } from "@/schemas/fleet-service";

import { actualizeazaPlanService, creeazaPlanService } from "../actions-service";
import { ETICHETE_TIP_SERVICE } from "../etichete-service";
import { valoriPlan, valoriPlanActualizat } from "./valori-service";

/**
 * Planul de service: creare ȘI corectură, aceleași câmpuri.
 *
 * ── CE ARATĂ LA FINAL ────────────────────────────────────────────────────────
 * „Următoarea scadență” se calculează AICI, din cele patru câmpuri, cu aceeași
 * regulă ca triggerul `vsp_inainte` (`urmatoareaScadenta`), ca omul să vadă
 * înainte de salvare ce a ales. La corectură, intervențiile legate de plan
 * (cunoscute din `ultima_*` a planului, vezi `ultimaEfectiva`) intră în calcul
 * ca în trigger; cifra reală o dă oricum baza, aici e doar previzualizarea.
 *
 * ── DE CE `baza_*` ȘI NU „ultima” ────────────────────────────────────────────
 * `ultima_data` / `ultimii_km` se derivă în bază (cea mai recentă dintre bază și
 * intervențiile legate). Omul introduce de unde pornește numărătoarea.
 */
interface Proprietati {
  readonly vehiculId: string;
  readonly kmCurent: number;
  /** Ziua de azi (Europe/Bucharest), din server: același text la randare și la hidratare. */
  readonly azi: string;
  /** Planul care se corectează. Absent la creare. */
  readonly plan?: PlanService | undefined;
}

function CampuriPlan({
  stare,
  idc,
  kmCurent,
  azi,
  plan,
}: Readonly<{
  stare: StareFormular<unknown>;
  idc: (sufix: string) => string;
  kmCurent: number;
  azi: string;
  plan: PlanService | undefined;
}>): ReactElement {
  const trimis = stare.valoriTrimise;
  const [baza, setBaza] = useState(trimis["baza_data"] ?? plan?.baza_data ?? azi);
  const [bazaKm, setBazaKm] = useState(trimis["baza_km"] ?? String(plan?.baza_km ?? kmCurent));
  const [intKm, setIntKm] = useState(trimis["interval_km"] ?? String(plan?.interval_km ?? ""));
  const [intLuni, setIntLuni] = useState(
    trimis["interval_luni"] ?? String(plan?.interval_luni ?? ""),
  );

  const dataValida = /^\d{4}-\d{2}-\d{2}$/u.test(baza);
  const km = bazaKm.trim() === "" ? Number.NaN : Number(bazaKm);
  const iKm = intKm.trim() === "" ? null : Number(intKm);
  const iLuni = intLuni.trim() === "" ? null : Number(intLuni);
  const previzualizare =
    dataValida &&
    Number.isFinite(km) &&
    (iKm === null || (Number.isFinite(iKm) && iKm > 0)) &&
    (iLuni === null || (Number.isInteger(iLuni) && iLuni > 0 && iLuni <= 240)) &&
    (iKm !== null || iLuni !== null)
      ? scadentaPlan(
          (() => {
            // Ca triggerul: intervențiile legate de plan pot fi peste baza introdusă.
            const ultima = ultimaEfectiva({ data: baza, km }, plan ?? null);
            const s = urmatoareaScadenta({
              ultimaData: ultima.data,
              ultimiiKm: ultima.km,
              intervalKm: iKm,
              intervalLuni: iLuni,
            });
            return { urmatoarea_data: s.data, urmatorii_km: s.km };
          })(),
        )
      : null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Camp
        nume="denumire"
        id={idc("denumire")}
        eticheta="Denumirea planului"
        obligatoriu
        ajutor="De exemplu „Revizie periodică” sau „Schimb distribuție”."
        erori={stare.erori["denumire"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={120}
            defaultValue={trimis["denumire"] ?? plan?.denumire ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="tip"
        id={idc("tip")}
        eticheta="Tipul lucrării"
        fel="select"
        erori={stare.erori["tip"] ?? []}
      >
        {(a) => (
          <select {...a} defaultValue={trimis["tip"] ?? plan?.tip ?? "revizie"}>
            {TIPURI_SERVICE.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP_SERVICE[t]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="interval_km"
        id={idc("interval_km")}
        eticheta="La fiecare (km)"
        ajutor="Cel puțin unul dintre cele două intervale."
        erori={stare.erori["interval_km"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="100"
            max="1000000"
            step="1"
            inputMode="numeric"
            value={intKm}
            onChange={(e) => {
              setIntKm(e.target.value);
            }}
          />
        )}
      </Camp>

      <Camp
        nume="interval_luni"
        id={idc("interval_luni")}
        eticheta="La fiecare (luni)"
        erori={stare.erori["interval_luni"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="1"
            max="240"
            step="1"
            inputMode="numeric"
            value={intLuni}
            onChange={(e) => {
              setIntLuni(e.target.value);
            }}
          />
        )}
      </Camp>

      <Camp
        nume="baza_data"
        id={idc("baza_data")}
        eticheta="Ultima intervenție — data"
        obligatoriu
        ajutor="Dacă nu o știți, lăsați azi: planul începe să numere de acum."
        erori={stare.erori["baza_data"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="date"
            max={azi}
            value={baza}
            onChange={(e) => {
              setBaza(e.target.value);
            }}
          />
        )}
      </Camp>

      <Camp
        nume="baza_km"
        id={idc("baza_km")}
        eticheta="Ultima intervenție — kilometraj"
        obligatoriu
        erori={stare.erori["baza_km"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={bazaKm}
            onChange={(e) => {
              setBazaKm(e.target.value);
            }}
          />
        )}
      </Camp>

      <p
        className="text-corp sm:col-span-2"
        aria-live="polite"
        data-testid="previzualizare-scadenta"
      >
        {previzualizare === null ? (
          <span className="text-muted-foreground">
            Completați data, kilometrajul și cel puțin un interval ca să vedeți următoarea scadență.
          </span>
        ) : (
          <>
            Următoarea scadență: <strong>{previzualizare}</strong>
          </>
        )}
      </p>

      <Camp
        nume="prag_avertizare_km"
        id={idc("prag_avertizare_km")}
        eticheta="Avertizare cu (km) înainte"
        ajutor="Alerta pe kilometri pleacă la acest număr de km înainte de scadență. Implicit 1.000."
        erori={stare.erori["prag_avertizare_km"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            max="100000"
            step="1"
            inputMode="numeric"
            defaultValue={trimis["prag_avertizare_km"] ?? String(plan?.prag_avertizare_km ?? "")}
          />
        )}
      </Camp>

      {plan === undefined ? null : (
        <label className="text-corp flex items-center gap-2 self-end pb-2">
          <input
            type="checkbox"
            name="activ"
            className={clasaBifa}
            defaultChecked={
              Object.keys(trimis).length === 0 ? plan.activ : trimis["activ"] === "on"
            }
          />
          Planul e activ (oprit, iese din scadențe și alerte)
        </label>
      )}

      <Camp
        nume="observatii"
        id={idc("observatii")}
        eticheta="Observații"
        fel="textarea"
        className="sm:col-span-2"
        erori={stare.erori["observatii"] ?? []}
      >
        {(a) => (
          <textarea
            {...a}
            maxLength={1000}
            rows={2}
            defaultValue={trimis["observatii"] ?? plan?.observatii ?? ""}
          />
        )}
      </Camp>
    </div>
  );
}

export function DialogPlanService({ vehiculId, kmCurent, azi, plan }: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    if (plan === undefined) {
      return creeazaPlanService({ vehicle_id: vehiculId, ...valoriPlan(date) });
    }
    return actualizeazaPlanService({
      id: plan.id,
      vehicle_id: vehiculId,
      ...valoriPlanActualizat(date),
    });
  }

  return (
    <FormularDialog
      declansator={
        plan === undefined
          ? {
              eticheta: "Plan nou",
              varianta: "secundar",
              pictograma: <ListChecks aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: <Pencil aria-hidden="true" className="size-4" />,
              varianta: "tertiar",
              marime: "iconita",
              "aria-label": `Modifică planul „${plan.denumire}”`,
            }
      }
      titlu={plan === undefined ? "Plan de service nou" : `Modifică „${plan.denumire}”`}
      descriere="Planul spune când e următoarea lucrare: după kilometri, după timp, sau după cel care vine primul. Scadența pe dată primește alerte înainte de termen; cea pe kilometri trimite o alertă când se apropie ținta."
      marime="mare"
      actiune={trimite}
      mesajReusita={plan === undefined ? "Planul a fost adăugat." : "Planul a fost salvat."}
      etichetaTrimite={plan === undefined ? "Adaugă planul" : "Salvează planul"}
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <CampuriPlan stare={stare} idc={idc} kmCurent={kmCurent} azi={azi} plan={plan} />
      )}
    </FormularDialog>
  );
}
