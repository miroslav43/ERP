// src/app/(app)/mentenanta/interventii/[id]/proces-verbal/page.tsx
//
// Procesul-verbal de intervenție, de tipărit și semnat (M6). Registrul de
// documente îl înregistrează deja la INSERT ca `pv_interventie` (0136/0142);
// documentul are acum și număr propriu, `PV-AAAA-NNNN` (0192).
//
// Ca la PV-ul de predare din inventar (`inventar/[id]/pv/[alocare]`): o pagină cu
// `window.print()` și foaia `@media print`, generată din rânduri la fiecare
// deschidere, nu un fișier salvat — o hârtie tipărită azi și una tipărită mâine
// spun același lucru doar dacă vin din aceleași date. Scanul semnat se urcă pe
// fișa intervenției, ca document de tip „proces-verbal”.
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import { cn } from "@/lib/ui/cn";
import {
  angajatiDupaId,
  citesteInterventie,
  citestePlan,
  citesteSesizare,
  echipamenteDupaId,
  piesePeInterventie,
} from "@/lib/queries/maintenance";

import {
  ETICHETE_REZULTAT_INTERVENTIE,
  ETICHETE_TIP_MENTENANTA,
  formatCifraContor,
} from "../../../etichete";
import { formatDurataMinute } from "../../../durata";
import { ButonTiparPv } from "./buton-tipar";

export const metadata: Metadata = { title: "Proces-verbal de intervenție" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

/** Un rând al PV-ului. Lipsa se scrie „—”: pe o hârtie semnată, rând gol ≠ rând absent. */
function Rand({ eticheta, valoare }: Readonly<{ eticheta: string; valoare: ReactNode }>) {
  return (
    <div className="border-border flex items-baseline justify-between gap-4 border-b py-1.5 last:border-0">
      <dt className="text-corp">{eticheta}</dt>
      <dd className="text-corp text-right font-medium">
        {valoare === null || valoare === undefined || valoare === "" ? "—" : valoare}
      </dd>
    </div>
  );
}

export default async function PaginaProcesVerbalInterventie({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "maintenance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "maintenance:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta intervențiile de mentenanță, deci nici procesele-verbale ale lor." />
    );
  }

  const interventie = await citesteInterventie(tenant.organizationId, id);
  if (interventie === null) notFound();

  const [echipamente, plan, sesizare, executanti, piese] = await Promise.all([
    echipamenteDupaId(tenant.organizationId, [interventie.equipment_id]),
    interventie.plan_id === null
      ? Promise.resolve(null)
      : citestePlan(tenant.organizationId, interventie.plan_id),
    interventie.fault_report_id === null
      ? Promise.resolve(null)
      : citesteSesizare(tenant.organizationId, interventie.fault_report_id),
    angajatiDupaId(
      tenant.organizationId,
      interventie.executant_employee_id === null ? [] : [interventie.executant_employee_id],
    ),
    piesePeInterventie(tenant.organizationId, interventie.id),
  ]);
  const echipament = echipamente.get(interventie.equipment_id);
  const numeFirma = tenant.legalName ?? tenant.name;
  const executant =
    interventie.executant_extern ??
    (interventie.executant_employee_id === null
      ? null
      : (executanti.get(interventie.executant_employee_id)?.full_name ?? null));

  return (
    <div className={cn(LATIMI.formular, "space-y-6 print:max-w-none")}>
      <div className="flex items-center justify-between gap-4 print:hidden">
        <Link
          href={`/mentenanta/interventii/${interventie.id}`}
          className="text-corp underline-offset-2 hover:underline"
        >
          ← Înapoi la intervenție
        </Link>
        <ButonTiparPv />
      </div>

      <AntetPagina
        className="border-foreground/60 gap-1 border-b pb-4 print:break-inside-avoid"
        titlu={`Proces-verbal de intervenție nr. ${interventie.numar}`}
        file={
          <div className="text-corp space-y-1">
            <p className="font-medium">{numeFirma}</p>
            <p>
              Încheiat la {formatDate(interventie.data)}
              {interventie.ora_start === null ? "" : `, ora ${interventie.ora_start.slice(0, 5)}`}
            </p>
          </div>
        }
      />

      <section aria-labelledby="pv-echipament" className="print:break-inside-avoid">
        <h2 id="pv-echipament" className="text-sectiune mb-2 font-medium">
          Echipamentul
        </h2>
        <dl>
          <Rand
            eticheta="Cod și denumire"
            valoare={echipament === undefined ? null : `${echipament.cod} — ${echipament.denumire}`}
          />
          <Rand
            eticheta="Citirea contorului la intervenție"
            valoare={
              interventie.citire_contor === null
                ? null
                : formatCifraContor(interventie.citire_contor)
            }
          />
        </dl>
      </section>

      <section aria-labelledby="pv-lucrare" className="print:break-inside-avoid">
        <h2 id="pv-lucrare" className="text-sectiune mb-2 font-medium">
          Lucrarea
        </h2>
        <dl>
          <Rand eticheta="Tipul intervenției" valoare={ETICHETE_TIP_MENTENANTA[interventie.tip]} />
          <Rand eticheta="Din planul de mentenanță" valoare={plan?.denumire ?? null} />
          <Rand eticheta="La sesizarea" valoare={sesizare === null ? null : sesizare.numar} />
          <Rand eticheta="Executant" valoare={executant} />
          <Rand eticheta="Document al furnizorului" valoare={interventie.numar_document_furnizor} />
          <Rand
            eticheta="Durata"
            valoare={
              interventie.durata_ore === null
                ? null
                : formatDurataMinute(Math.round(interventie.durata_ore * 60))
            }
          />
          <Rand
            eticheta="Echipamentul a stat oprit"
            valoare={
              interventie.oprire_minute === null || interventie.oprire_minute === 0
                ? null
                : formatDurataMinute(interventie.oprire_minute)
            }
          />
          <Rand eticheta="Rezultat" valoare={ETICHETE_REZULTAT_INTERVENTIE[interventie.rezultat]} />
          <Rand
            eticheta="Garanția lucrării"
            valoare={
              interventie.garantie_lucrare_pana === null
                ? null
                : `până la ${formatDate(interventie.garantie_lucrare_pana)}`
            }
          />
        </dl>
        <p className="text-corp mt-3 font-medium">Ce s-a făcut</p>
        <p className="text-corp whitespace-pre-line">{interventie.descriere}</p>
        {interventie.observatii === null ? null : (
          <>
            <p className="text-corp mt-3 font-medium">Observații</p>
            <p className="text-corp whitespace-pre-line">{interventie.observatii}</p>
          </>
        )}
      </section>

      <section aria-labelledby="pv-piese" className="print:break-inside-avoid">
        <h2 id="pv-piese" className="text-sectiune mb-2 font-medium">
          Piese și costuri
        </h2>
        {piese.length === 0 ? (
          <p className="text-corp">{interventie.piese ?? "Fără piese înlocuite."}</p>
        ) : (
          <table className="text-corp w-full border-collapse">
            <caption className="sr-only">Piesele folosite la intervenție.</caption>
            <thead>
              <tr className="border-foreground/60 border-b text-left">
                <th scope="col" className="py-1.5 font-medium">
                  Piesă
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Cantitate
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Preț unitar
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Valoare
                </th>
              </tr>
            </thead>
            <tbody>
              {piese.map((p) => (
                <tr key={p.id} className="border-border border-b">
                  <td className="py-1.5">
                    {p.denumire}
                    {p.cod === null ? "" : ` (${p.cod})`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatCifraContor(p.cantitate)} {p.unitate}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatLei(p.pret_unitar)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatLei(p.valoare ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <dl className="mt-3">
          <Rand eticheta="Cost piese" valoare={formatLei(interventie.cost_piese)} />
          <Rand eticheta="Cost manoperă" valoare={formatLei(interventie.cost_manopera)} />
          <Rand
            eticheta="Total"
            valoare={formatLei(
              interventie.cost_total ?? interventie.cost_piese + interventie.cost_manopera,
            )}
          />
          {interventie.acoperit_de_garantie ? (
            <Rand eticheta="Acoperit de garanție" valoare="Da" />
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="pv-semnaturi" className="print:break-inside-avoid">
        <h2 id="pv-semnaturi" className="text-sectiune mb-3 font-medium">
          Semnături
        </h2>
        <p className="text-corp mb-4">
          Prin semnarea prezentului proces-verbal, executantul confirmă lucrările de mai sus, iar
          beneficiarul confirmă recepția lor și starea echipamentului la predare.
        </p>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-corp font-medium">Executant</p>
            <p className="text-muted-foreground text-nota mt-1">{executant ?? "—"}</p>
            <div className="border-foreground/60 mt-10 border-t pt-1">
              <p className="text-muted-foreground text-nota">Nume, prenume și semnătura</p>
            </div>
          </div>
          <div>
            <p className="text-corp font-medium">Beneficiar</p>
            <p className="text-muted-foreground text-nota mt-1">{numeFirma}</p>
            <div className="border-foreground/60 mt-10 border-t pt-1">
              <p className="text-muted-foreground text-nota">Nume, prenume și semnătura</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
