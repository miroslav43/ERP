// src/app/(app)/salarizare/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { Badge } from "@/components/ui/badge";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  angajatiActiviCuContract,
  citestePerioada,
  listeazaInregistrari,
  primeSiRetineriPerioada,
  type RandInregistrare,
  type RandPrimaPerioada,
  type RandRetinerePerioada,
} from "@/lib/queries/payroll";
import { Receipt, Users } from "lucide-react";

import { TONURI_STATUS_PERIOADA, ETICHETE_STATUS_PERIOADA, numeLuna } from "../etichete";
import { ActiuniPerioada } from "./actiuni-perioada";
import { RandAngajatDraft } from "./rand-angajat-draft";

export const metadata: Metadata = { title: "Perioadă de salarizare" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaPerioada({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "payroll");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "payroll:read", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta salarizarea." />
      </div>
    );
  }

  const perioada = await citestePerioada(tenant.organizationId, id);
  if (perioada === null) notFound();

  const inregistrari = perioada.status === "draft" ? [] : await listeazaInregistrari(perioada.id);
  const poateCalcula = can(permisiuni, "payroll:create", "all");
  const poateAproba = can(permisiuni, "payroll:approve", "all");
  const poateExporta = can(permisiuni, "payroll:export", "all");

  const personalDraft =
    perioada.status === "draft" && poateCalcula
      ? await angajatiActiviCuContract(tenant.organizationId, perioada.an, perioada.luna)
      : { angajati: [], faraContract: [], trunchiat: false };
  const angajatiDraft = personalDraft.angajati;
  const { prime, retineri } =
    perioada.status === "draft" && poateCalcula
      ? await primeSiRetineriPerioada(tenant.organizationId, perioada.id)
      : { prime: [], retineri: [] };

  const primePeAngajat = new Map<string, RandPrimaPerioada[]>();
  for (const p of prime) {
    primePeAngajat.set(p.employee_id, [...(primePeAngajat.get(p.employee_id) ?? []), p]);
  }
  const retineriPeAngajat = new Map<string, RandRetinerePerioada[]>();
  for (const r of retineri) {
    retineriPeAngajat.set(r.employee_id, [...(retineriPeAngajat.get(r.employee_id) ?? []), r]);
  }

  /*
   * Înregistrările se citesc întregi (fără cursor keyset), deci antetele nu
   * pretind că sortează. Toate cifrele sunt `numeric`: patru coloane de bani una
   * lângă alta se citesc doar aliniate la dreapta, pe verticală.
   */
  const coloane: readonly Coloana<RandInregistrare>[] = [
    {
      cheie: "angajat",
      antet: "Angajat",
      peTelefon: "titlu",
      celula: (r) => r.angajat?.full_name ?? r.angajat?.marca ?? "—",
    },
    {
      cheie: "brut",
      antet: "Brut",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatLei(r.brut),
    },
    {
      cheie: "net",
      antet: "Net",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatLei(r.net),
    },
    {
      cheie: "net_de_plata",
      antet: "Net de plată",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatLei(r.net_de_plata),
    },
    {
      cheie: "cost_angajator",
      antet: "Cost angajator",
      numeric: true,
      peTelefon: "meta",
      celula: (r) => formatLei(r.cost_total_angajator),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-muted-foreground text-corp">
          <Link href="/salarizare" className="underline-offset-2 hover:underline">
            Salarizare
          </Link>
        </p>
        <AntetPagina
          titlu={`${numeLuna(perioada.luna)} ${String(perioada.an)}`}
          actiuni={
            <Badge ton={TONURI_STATUS_PERIOADA[perioada.status] ?? "neutru"}>
              {ETICHETE_STATUS_PERIOADA[perioada.status] ?? perioada.status}
            </Badge>
          }
        />
      </div>

      <section
        aria-label="Totaluri"
        className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-3"
      >
        <div>
          <dt className="text-muted-foreground text-nota">Total brut</dt>
          <dd className="text-sectiune font-medium">{formatLei(perioada.total_brut)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-nota">Total net</dt>
          <dd className="text-sectiune font-medium">{formatLei(perioada.total_net)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-nota">Cost total angajator</dt>
          <dd className="text-sectiune font-medium">{formatLei(perioada.total_cost_angajator)}</dd>
        </div>
      </section>

      <ActiuniPerioada
        id={perioada.id}
        status={perioada.status}
        poateCalcula={poateCalcula}
        poateAproba={poateAproba}
        poateExporta={poateExporta}
      />

      {perioada.status !== "aprobat" && perioada.status !== "inchis" ? null : (
        <section aria-label="Livrabile" className="border-border rounded-panou border p-4">
          <h2 className="text-corp mb-1 font-medium">Livrabile</h2>
          <p className="text-muted-foreground text-nota mb-3">
            Statul de plată e documentul care se semnează și se arhivează. Fișierul bancar plătește
            restul de plată, nu netul: el scade avantajele primite în natură și adaugă sumele
            neimpozabile. Generarea lui decriptează IBAN-ul fiecărui angajat și lasă câte un rând de
            audit. Declarația 112 conține CNP-ul fiecărui asigurat, deci cere aceleași drepturi;
            contabilul o validează cu DUKIntegrator înainte de depunere.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/export/salarizare/bancar?perioada=${perioada.id}`}
              className={buton({ varianta: "secundar" })}
            >
              Fișier bancar (SEPA)
            </a>
            <a
              href={`/api/export/salarizare/nota?perioada=${perioada.id}`}
              className={buton({ varianta: "secundar" })}
            >
              Notă contabilă (CSV)
            </a>
            <a
              href={`/api/export/salarizare/stat?perioada=${perioada.id}`}
              className={buton({ varianta: "secundar" })}
            >
              Stat de plată (PDF)
            </a>
            <a
              href={`/api/export/salarizare/d112?perioada=${perioada.id}`}
              className={buton({ varianta: "secundar" })}
            >
              Declarația 112 (XML)
            </a>
          </div>
        </section>
      )}

      {perioada.status === "draft" ? (
        <>
          <StareGoala
            fel="initiala"
            pictograma={Users}
            titlu="Perioada nu a fost încă calculată"
            descriere="Adăugați bonusuri sau rețineri per angajat mai jos, apoi apăsați „Calculează” pentru a genera fluturașii tuturor angajaților activi cu contract activ, pe baza pontajului blocat al lunii."
          />
          {poateCalcula && angajatiDraft.length > 0 ? (
            <ul className="border-border divide-border rounded-panou divide-y border">
              {angajatiDraft.map((a) => (
                <li key={a.employee_id} className="p-4">
                  <RandAngajatDraft
                    periodId={perioada.id}
                    employeeId={a.employee_id}
                    nume={a.full_name || a.marca}
                    salariuBaza={a.salariu_baza}
                    prime={primePeAngajat.get(a.employee_id) ?? []}
                    retineri={retineriPeAngajat.get(a.employee_id) ?? []}
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <Tabel
          caption={`Fluturașii perioadei ${numeLuna(perioada.luna)} ${String(perioada.an)}`}
          coloane={coloane}
          randuri={inregistrari}
          cheieRand={(r) => r.id}
          href={(r) => `/salarizare/${perioada.id}/${r.id}`}
          gol={
            <StareGoala
              fel="initiala"
              pictograma={Receipt}
              titlu="Niciun fluturaș în perioadă"
              descriere="Perioada a fost calculată, dar nu are nicio înregistrare. Verificați dacă există angajați activi cu contract activ în luna respectivă."
            />
          }
        />
      )}
    </div>
  );
}
