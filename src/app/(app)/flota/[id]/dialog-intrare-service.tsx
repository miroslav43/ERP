"use client";

import { Plus, Wrench } from "lucide-react";
import { useState, type ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { StareFormular } from "@/components/ui/formular";
import { evaluareKmIntrare } from "@/domain/fleet/service";
import type { PlanService } from "@/lib/queries/fleet-service";
import { ANVELOPE_MONTATE } from "@/schemas/fleet";
import { TIPURI_SERVICE } from "@/schemas/fleet-service";

import { adaugaIntrareService } from "../actions-service";
import { ETICHETE_ANVELOPE, ETICHETE_TIP_SERVICE } from "../etichete-service";
import { valoriIntrare } from "./valori-service";

/**
 * Intervenția făcută: ce s-a lucrat, la ce kilometraj, cât a costat.
 *
 * Nu există „modifică”: intervenția nu se schimbă după salvare (baza refuză),
 * se șterge și se reintroduce — ca un plan să nu poată fi mutat de o corectură
 * tăcută. De aceea caseta explică înainte de salvare ce se va întâmpla: planul
 * ales își mută scadența, iar kilometrajul vehiculului urcă dacă cifra e mai
 * mare.
 *
 * Kilometrajul se judecă pe loc cu `evaluareKmIntrare` (aceeași regulă ca între
 * foi): sub kilometrajul vehiculului e o intervenție veche (se păstrează ca
 * istoric), iar un salt peste prag e, de obicei, o cifră greșită. Se SEMNALEAZĂ,
 * nu se blochează — bordul din service e de încredere.
 */
interface Proprietati {
  readonly vehiculId: string;
  readonly kmCurent: number;
  readonly pragSalt: number;
  readonly azi: string;
  /** Planurile ACTIVE ale vehiculului, pentru legare. */
  readonly planuri: readonly PlanService[];
  /** Planul preselectat (butonul „Înregistrează” de pe rândul lui). Absent ⇒ butonul general. */
  readonly planImplicit?: PlanService | undefined;
}

const fmtKm = (n: number): string => n.toLocaleString("ro-RO");

function CampuriIntrare({
  stare,
  idc,
  kmCurent,
  pragSalt,
  azi,
  planuri,
  planImplicit,
}: Readonly<{
  stare: StareFormular<unknown>;
  idc: (sufix: string) => string;
  kmCurent: number;
  pragSalt: number;
  azi: string;
  planuri: readonly PlanService[];
  planImplicit: PlanService | undefined;
}>): ReactElement {
  const trimis = stare.valoriTrimise;
  const [km, setKm] = useState(trimis["km"] ?? String(kmCurent));
  const [tip, setTip] = useState(trimis["tip"] ?? planImplicit?.tip ?? "revizie");
  const [planId, setPlanId] = useState(trimis["plan_id"] ?? planImplicit?.id ?? "");

  const kmNumar = km.trim() === "" ? Number.NaN : Number(km);
  const verdict =
    Number.isInteger(kmNumar) && kmNumar >= 0
      ? evaluareKmIntrare(kmCurent, kmNumar, pragSalt)
      : "ok";
  const ajutorKm =
    verdict === "veche"
      ? `Sub kilometrajul vehiculului (${fmtKm(kmCurent)} km): se păstrează ca istoric și kilometrajul nu coboară.`
      : verdict === "salt"
        ? `Cu ${fmtKm(kmNumar - kmCurent)} km peste kilometrajul vehiculului (${fmtKm(kmCurent)} km). Verificați cifra: dacă o salvați, kilometrajul vehiculului urcă la ea.`
        : `Cifra de pe bord la intervenție. Vehiculul are acum ${fmtKm(kmCurent)} km.`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Camp
        nume="plan_id"
        id={idc("plan_id")}
        eticheta="Din planul"
        fel="select"
        ajutor="Legat de un plan, își mută scadența. Lăsați gol pentru o reparație întâmplătoare."
        erori={stare.erori["plan_id"] ?? []}
      >
        {(a) => (
          <select
            {...a}
            value={planId}
            onChange={(e) => {
              setPlanId(e.target.value);
              const ales = planuri.find((p) => p.id === e.target.value);
              if (ales !== undefined) setTip(ales.tip);
            }}
          >
            <option value="">Fără plan</option>
            {planuri.map((p) => (
              <option key={p.id} value={p.id}>
                {p.denumire}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="tip"
        id={idc("tip")}
        eticheta="Tipul lucrării"
        fel="select"
        obligatoriu
        erori={stare.erori["tip"] ?? []}
      >
        {(a) => (
          <select
            {...a}
            value={tip}
            onChange={(e) => {
              setTip(e.target.value);
            }}
          >
            {TIPURI_SERVICE.map((t) => (
              <option key={t} value={t}>
                {ETICHETE_TIP_SERVICE[t]}
              </option>
            ))}
          </select>
        )}
      </Camp>

      <Camp
        nume="data_interventiei"
        id={idc("data_interventiei")}
        eticheta="Data intervenției"
        obligatoriu
        erori={stare.erori["data_interventiei"] ?? []}
      >
        {(a) => (
          <input {...a} type="date" max={azi} defaultValue={trimis["data_interventiei"] ?? azi} />
        )}
      </Camp>

      <Camp
        nume="km"
        id={idc("km")}
        eticheta="Kilometraj la bord"
        obligatoriu
        ajutor={ajutorKm}
        erori={stare.erori["km"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            value={km}
            onChange={(e) => {
              setKm(e.target.value);
            }}
          />
        )}
      </Camp>

      <Camp
        nume="descriere"
        id={idc("descriere")}
        eticheta="Ce s-a lucrat"
        obligatoriu
        className="sm:col-span-2"
        erori={stare.erori["descriere"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={500}
            defaultValue={trimis["descriere"] ?? planImplicit?.denumire ?? ""}
          />
        )}
      </Camp>

      {tip === "anvelope" ? (
        <Camp
          nume="anvelope_montate"
          id={idc("anvelope_montate")}
          eticheta="Anvelope montate după lucrare"
          fel="select"
          ajutor="Se trec pe vehicul, la „Anvelope montate”."
          erori={stare.erori["anvelope_montate"] ?? []}
        >
          {(a) => (
            <select {...a} defaultValue={trimis["anvelope_montate"] ?? ""}>
              <option value="">Nu schimbă</option>
              {ANVELOPE_MONTATE.map((c) => (
                <option key={c} value={c}>
                  {ETICHETE_ANVELOPE[c]}
                </option>
              ))}
            </select>
          )}
        </Camp>
      ) : null}

      <Camp
        nume="furnizor"
        id={idc("furnizor")}
        eticheta="Furnizor"
        erori={stare.erori["furnizor"] ?? []}
      >
        {(a) => (
          <input {...a} type="text" maxLength={120} defaultValue={trimis["furnizor"] ?? ""} />
        )}
      </Camp>

      <Camp
        nume="numar_factura"
        id={idc("numar_factura")}
        eticheta="Număr factură"
        erori={stare.erori["numar_factura"] ?? []}
      >
        {(a) => (
          <input {...a} type="text" maxLength={60} defaultValue={trimis["numar_factura"] ?? ""} />
        )}
      </Camp>

      <Camp
        nume="cost_piese"
        id={idc("cost_piese")}
        eticheta="Cost piese (lei)"
        erori={stare.erori["cost_piese"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={trimis["cost_piese"] ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="cost_manopera"
        id={idc("cost_manopera")}
        eticheta="Cost manoperă (lei)"
        erori={stare.erori["cost_manopera"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            defaultValue={trimis["cost_manopera"] ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="observatii"
        id={idc("observatii")}
        eticheta="Observații"
        fel="textarea"
        className="sm:col-span-2"
        erori={stare.erori["observatii"] ?? []}
      >
        {(a) => (
          <textarea {...a} maxLength={1000} rows={2} defaultValue={trimis["observatii"] ?? ""} />
        )}
      </Camp>
    </div>
  );
}

export function DialogIntrareService({
  vehiculId,
  kmCurent,
  pragSalt,
  azi,
  planuri,
  planImplicit,
}: Proprietati): ReactElement {
  async function trimite(date: FormData) {
    return adaugaIntrareService({ vehicle_id: vehiculId, ...valoriIntrare(date) });
  }

  return (
    <FormularDialog
      declansator={
        planImplicit === undefined
          ? {
              eticheta: "Intervenție nouă",
              varianta: "secundar",
              pictograma: <Wrench aria-hidden="true" className="size-4" />,
            }
          : {
              eticheta: <Plus aria-hidden="true" className="size-4" />,
              varianta: "tertiar",
              marime: "iconita",
              "aria-label": `Înregistrează intervenția pentru „${planImplicit.denumire}”`,
            }
      }
      titlu={
        planImplicit === undefined
          ? "Intervenție de service"
          : `Intervenție: ${planImplicit.denumire}`
      }
      descriere="Intervenția nu se mai modifică după salvare: dacă greșiți, o ștergeți și o adăugați din nou. Planul ales își mută scadența, iar kilometrajul vehiculului urcă dacă cifra e mai mare."
      marime="mare"
      actiune={trimite}
      mesajReusita="Intervenția a fost înregistrată."
      etichetaTrimite="Înregistrează intervenția"
      textInCurs="Se salvează…"
    >
      {(stare, idc) => (
        <CampuriIntrare
          stare={stare}
          idc={idc}
          kmCurent={kmCurent}
          pragSalt={pragSalt}
          azi={azi}
          planuri={planuri}
          planImplicit={planImplicit}
        />
      )}
    </FormularDialog>
  );
}
