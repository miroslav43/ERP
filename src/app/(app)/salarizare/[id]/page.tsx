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
import { formatDate, formatDateTime } from "@/lib/format/date";
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
import { AlertTriangle, Receipt, Users } from "lucide-react";

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

  const registru =
    perioada.status === "draft"
      ? { randuri: [] as readonly RandInregistrare[], trunchiat: false }
      : await listeazaInregistrari(perioada.id);
  const inregistrari = registru.randuri;
  const poateCalcula = can(permisiuni, "payroll:create", "all");
  const poateModifica = can(permisiuni, "payroll:update", "all");
  const poateAproba = can(permisiuni, "payroll:approve", "all");
  const poateExporta = can(permisiuni, "payroll:export", "all");

  const personalDraft =
    perioada.status === "draft" && poateCalcula
      ? await angajatiActiviCuContract(tenant.organizationId, perioada.an, perioada.luna)
      : { angajati: [], faraContract: [], trunchiat: false };
  const angajatiDraft = personalDraft.angajati;
  /*
   * Cele două semnale pe care citirea le calculează anume ca să nu dispară
   * nimeni tăcut de pe stat — și pe care ecranul le arunca la gunoi.
   *
   * `faraContract`: angajați ACTIVI pentru care luna nu are niciun contract
   * aplicabil. `calculeazaPerioada` (actions.ts) refuză calculul cât timp lista
   * nu e goală, dar refuzul venea abia după clic; până atunci nimic nu spunea
   * că patru oameni lipsesc de pe statul de plată.
   *
   * `trunchiat`: citirea a atins plafonul de siguranță de 50.000 de angajați,
   * deci cifrele NU sunt complete. Un stat de plată incomplet care arată
   * complet e cea mai scumpă clasă de defect din modul.
   */
  const faraContract = personalDraft.faraContract;
  const blocajCalcul = personalDraft.trunchiat
    ? "Calculul e blocat: citirea angajaților e incompletă."
    : faraContract.length > 0
      ? `Calculul e blocat: ${String(faraContract.length)} ${faraContract.length === 1 ? "angajat activ nu are" : "angajați activi nu au"} contract aplicabil lunii.`
      : null;
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
        {/* Proveniența. Toate cifrele astea erau deja citite de
            `citestePerioada` și nu apărea niciuna: ecranul nu spunea nici când
            s-a calculat luna, nici peste ce pontaj, nici când s-a plătit. */}
        <p className="text-muted-foreground text-corp">
          {[
            perioada.calculat_la === null
              ? null
              : `Calculată la ${formatDateTime(perioada.calculat_la)}`,
            perioada.aprobat_la === null
              ? null
              : `aprobată la ${formatDateTime(perioada.aprobat_la)}`,
            perioada.inchis_la === null ? null : `închisă la ${formatDateTime(perioada.inchis_la)}`,
            perioada.data_plata === null ? null : `data plății ${formatDate(perioada.data_plata)}`,
          ]
            .filter((bucata) => bucata !== null)
            .join(" · ") || "Perioadă în ciornă, încă necalculată."}
          {" · "}
          <Link
            href={`/pontaj/perioade/${perioada.attendance_period_id}`}
            className="underline-offset-2 hover:underline"
          >
            pontajul lunii
          </Link>
        </p>
      </div>

      {/* `<dl>`, nu `<section>`: `dt`/`dd` în afara unei liste de definiții nu
          formează nicio pereche pentru cititorul de ecran — se aud trei
          etichete și trei sume, fără legătură între ele. */}
      <dl
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
      </dl>

      <ActiuniPerioada
        id={perioada.id}
        status={perioada.status}
        poateCalcula={poateCalcula}
        poateModifica={poateModifica}
        poateAproba={poateAproba}
        poateExporta={poateExporta}
        blocajCalcul={blocajCalcul}
        // Cifrele din confirmări. O consecință scrisă fără numere e o
        // avertizare generică; „89 de destinatari" e o decizie.
        rezumat={{
          perioada: `${numeLuna(perioada.luna)} ${String(perioada.an)}`,
          angajati: inregistrari.length,
          totalNet: formatLei(perioada.total_net),
          totalBrut: formatLei(perioada.total_brut),
        }}
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
          {!personalDraft.trunchiat ? null : (
            <div
              role="alert"
              className="border-danger/50 bg-danger/10 rounded-panou text-corp border p-4"
            >
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                Citirea angajaților a atins plafonul de siguranță.
              </p>
              <p className="mt-1">
                Lista de mai jos NU e completă, deci nici un stat de plată calculat acum n-ar fi.
                Calculul rămâne blocat până când citirea încape sub plafon. Anunțați administratorul
                platformei.
              </p>
            </div>
          )}

          {faraContract.length === 0 ? null : (
            <section
              aria-labelledby="fara-contract"
              className="border-warning/40 bg-warning/12 rounded-panou text-corp border p-4"
            >
              <h2 id="fara-contract" className="flex items-start gap-2 font-medium">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {faraContract.length === 1
                  ? "Un angajat activ nu are contract aplicabil lunii"
                  : `${String(faraContract.length)} angajați activi nu au contract aplicabil lunii`}
              </h2>
              <p className="mt-1">
                Fără contract valabil în {numeLuna(perioada.luna)} {perioada.an}, oamenii aceștia nu
                pot intra pe statul de plată, iar calculul refuză să pornească fără ei — altfel ar
                lipsi de pe stat fără ca nimeni să observe. Deschideți fișa fiecăruia și completați
                contractul sau actul adițional al lunii.
              </p>
              <ul className="mt-3 space-y-1">
                {faraContract.map((a) => (
                  <li key={a.employee_id}>
                    <Link
                      href={`/angajati/${a.employee_id}`}
                      className="underline underline-offset-2"
                    >
                      {a.full_name || "(fără nume)"}
                    </Link>{" "}
                    <span className="text-muted-foreground">marca {a.marca}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {angajatiDraft.length === 0 ? (
            <StareGoala
              fel="initiala"
              pictograma={Users}
              titlu="Perioada nu a fost încă calculată"
              descriere="Nu există încă niciun angajat cu contract aplicabil lunii. Completați contractele, apoi apăsați „Calculează” pentru a genera fluturașii pe baza pontajului blocat al lunii."
            />
          ) : (
            <section aria-labelledby="ajustari-ciorna" className="space-y-2">
              <h2 id="ajustari-ciorna" className="text-sectiune font-medium">
                {angajatiDraft.length === 1
                  ? "Un angajat de calculat"
                  : `${String(angajatiDraft.length)} angajați de calculat`}
              </h2>
              <p className="text-muted-foreground text-corp">
                Adăugați aici bonusurile și reținerile lunii, apoi apăsați „Calculează”. Fluturașii
                se generează pe baza pontajului blocat al lunii.
              </p>
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
                      poateSterge={poateModifica}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <Tabel
          caption={`Fluturașii perioadei ${numeLuna(perioada.luna)} ${String(perioada.an)}`}
          coloane={coloane}
          randuri={inregistrari}
          cheieRand={(r) => r.id}
          href={(r) => `/salarizare/${perioada.id}/${r.id}`}
          trunchiat={registru.trunchiat}
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
