// src/app/(app)/angajati/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AvatarAngajat } from "@/components/data/avatar-angajat";
import { IncarcareAvatar } from "@/components/forms/incarcare-avatar";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { pregatesteIncarcareAvatarulPropriu, salveazaAvatarulPropriu } from "@/lib/actions/profile";
import {
  citesteAngajat,
  citesteRezumatDateSensibile,
  idFisaProprie,
  lantulDeManageri,
} from "@/lib/queries/employees";

import { CLASE_STATUS, ETICHETE_CONTRACT, ETICHETE_MOD_LUCRU, ETICHETE_STATUS } from "../etichete";
import { DateSensibile } from "./date-sensibile";
import { FormularContractNou } from "./formular-contract-nou";
import { FormularInceteazaContract } from "./formular-inceteaza-contract";
import { FormularModificaSalariu } from "./formular-modifica-salariu";
import { IncarcareAvatarAdmin } from "./incarcare-avatar-admin";

export const metadata: Metadata = { title: "Fișa angajatului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

function Camp({
  eticheta,
  valoare,
}: {
  readonly eticheta: string;
  readonly valoare: string | null;
}) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-muted-foreground uppercase">{eticheta}</dt>
      <dd className="mt-0.5 text-sm">{valoare === null || valoare.length === 0 ? "—" : valoare}</dd>
    </div>
  );
}

export default async function PaginaFisaAngajat({ params }: ProprietatiPagina) {
  const { id } = await params;
  const utilizator = await requireUser();
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "nucleu");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);
  const scope = scopeFor(permisiuni, "employees:read") ?? undefined;

  if (scope === undefined) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta fișele de personal." />;
  }

  const propriaFisaId =
    scope === "all" ? null : await idFisaProprie(tenant.organizationId, utilizator.id);
  const angajat = await citesteAngajat(tenant.organizationId, id, scope, propriaFisaId);
  if (angajat === null) notFound();

  // Datele sensibile nu se randează deloc dacă scope-ul nu acoperă întreaga organizație.
  const rezumatSensibil =
    scope === "all" ? await citesteRezumatDateSensibile(tenant.organizationId, id) : null;
  const contractPrincipal =
    angajat.contracts.find((c) => !c.este_act_aditional && c.status === "activ") ?? null;
  const lantManageri = await lantulDeManageri(
    tenant.organizationId,
    angajat.manager_path,
    angajat.id,
  );
  const esteFisaProprie = angajat.user_id === utilizator.id;
  const poateIncarcaPtOricine = can(permisiuni, "users:update", "all");

  return (
    <main className="space-y-8 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <AvatarAngajat url={angajat.avatar_url} nume={angajat.full_name} marime="lg" />
          <div>
            <h1 className="text-2xl font-semibold">{angajat.full_name}</h1>
            <p className="text-sm text-muted-foreground">
              Marca <span className="font-mono">{angajat.marca}</span>
              {angajat.job_position !== null ? ` · ${angajat.job_position.denumire}` : ""}
              {angajat.department !== null ? ` · ${angajat.department.denumire}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {can(permisiuni, "employees:update", "all") ? (
            <Link
              href={`/angajati/${angajat.id}/editeaza`}
              className="border-foreground/60 hover:bg-surface rounded-md border px-3 py-1.5 text-sm font-medium"
            >
              Editează fișa
            </Link>
          ) : null}
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${CLASE_STATUS[angajat.status]}`}
          >
            {ETICHETE_STATUS[angajat.status]}
          </span>
        </div>
      </header>

      {esteFisaProprie ? (
        <section aria-labelledby="titlu-foto" className="rounded-lg border border-border p-4">
          <h2 id="titlu-foto" className="mb-4 text-lg font-medium">
            Fotografia mea
          </h2>
          <IncarcareAvatar
            urlInitial={angajat.avatar_url}
            nume={angajat.full_name}
            pregateste={pregatesteIncarcareAvatarulPropriu}
            salveaza={salveazaAvatarulPropriu}
          />
        </section>
      ) : poateIncarcaPtOricine ? (
        <section aria-labelledby="titlu-foto" className="rounded-lg border border-border p-4">
          <h2 id="titlu-foto" className="mb-4 text-lg font-medium">
            Fotografie de profil
          </h2>
          {angajat.user_id === null ? (
            <p className="text-sm text-muted-foreground">
              Acest angajat nu are cont în portal — nu i se poate atașa o fotografie pe această
              cale.
            </p>
          ) : (
            <IncarcareAvatarAdmin
              employeeId={angajat.id}
              urlInitial={angajat.avatar_url}
              nume={angajat.full_name}
            />
          )}
        </section>
      ) : null}

      <section aria-labelledby="titlu-ierarhie" className="rounded-lg border border-border p-4">
        <h2 id="titlu-ierarhie" className="mb-4 text-lg font-medium">
          Ierarhie managerială
        </h2>
        {lantManageri.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {angajat.manager_path.length <= 1
              ? "Nu are niciun manager direct."
              : "Lanțul de manageri nu a putut fi determinat."}
          </p>
        ) : (
          <ol className="flex flex-wrap items-center gap-2 text-sm">
            {lantManageri.map((veriga) => (
              <li key={veriga.id} className="flex items-center gap-2">
                <Link
                  href={`/angajati/${veriga.id}`}
                  className="border-border hover:bg-surface rounded-md border px-2 py-1"
                >
                  <span className="font-medium">{veriga.full_name}</span>
                  {veriga.job_position !== null ? (
                    <span className="text-muted-foreground"> · {veriga.job_position.denumire}</span>
                  ) : null}
                </Link>
                <span aria-hidden="true" className="text-muted-foreground">
                  →
                </span>
              </li>
            ))}
            <li className="border-foreground/60 bg-surface rounded-md border px-2 py-1 font-medium">
              {angajat.full_name}
            </li>
          </ol>
        )}
      </section>

      <section
        aria-labelledby="titlu-date-personale"
        className="rounded-lg border border-border p-4"
      >
        <h2 id="titlu-date-personale" className="mb-4 text-lg font-medium">
          Date personale
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Camp eticheta="Nume" valoare={angajat.last_name} />
          <Camp eticheta="Prenume" valoare={angajat.first_name} />
          <Camp
            eticheta="Data nașterii"
            valoare={angajat.data_nasterii === null ? null : formatDate(angajat.data_nasterii)}
          />
          <Camp eticheta="Cetățenie" valoare={angajat.cetatenie} />
          <Camp eticheta="E-mail personal" valoare={angajat.email_personal} />
          <Camp eticheta="Telefon" valoare={angajat.telefon} />
          <Camp
            eticheta="Adresă"
            valoare={[angajat.adresa_strada, angajat.adresa_oras, angajat.adresa_judet]
              .filter((v) => v !== null)
              .join(", ")}
          />
          <Camp
            eticheta="Persoane în întreținere"
            valoare={String(angajat.nr_persoane_intretinere)}
          />
          <Camp eticheta="Grad de handicap" valoare={angajat.grad_handicap} />
          <Camp
            eticheta="Angajat din"
            valoare={angajat.hired_on === null ? null : formatDate(angajat.hired_on)}
          />
          <Camp
            eticheta="Contact de urgență"
            valoare={[angajat.contact_urgenta_nume, angajat.contact_urgenta_telefon]
              .filter((v) => v !== null)
              .join(" · ")}
          />
        </dl>
      </section>

      <section
        aria-labelledby="titlu-contracte"
        className="rounded-lg border border-border p-4"
      >
        <h2 id="titlu-contracte" className="mb-4 text-lg font-medium">
          Contracte
        </h2>
        {angajat.contracts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Fișa nu are încă niciun contract. Adăugați contractul individual de muncă înainte de
            transmiterea în REVISAL.
          </p>
        ) : (
          <ul className="space-y-3">
            {angajat.contracts.map((contract) => (
              <li
                key={contract.id}
                className="rounded-md border border-border p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Contract nr. {contract.numar}</span>
                  {contract.id === contractPrincipal?.id ? (
                    <span className="rounded bg-surface px-2 py-0.5 text-xs font-medium text-foreground">
                      Contract principal
                    </span>
                  ) : null}
                  {contract.este_act_aditional ? (
                    <span className="rounded bg-surface px-2 py-0.5 text-xs">
                      Act adițional
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {ETICHETE_CONTRACT[contract.status] ?? contract.status}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Camp
                    eticheta="Valabil"
                    valoare={`${formatDate(contract.valabil_de_la)} – ${contract.valabil_pana === null ? "nedeterminat" : formatDate(contract.valabil_pana)}`}
                  />
                  <Camp
                    eticheta="Normă"
                    valoare={`${String(contract.norma_ore_saptamana)} ore/săptămână`}
                  />
                  <Camp eticheta="Salariu de bază" valoare={formatLei(contract.salariu_baza)} />
                  <Camp
                    eticheta="Mod de lucru"
                    valoare={ETICHETE_MOD_LUCRU[contract.work_mode] ?? contract.work_mode}
                  />
                  {contract.incetat_la !== null ? (
                    <Camp eticheta="Încetat la" valoare={formatDate(contract.incetat_la)} />
                  ) : null}
                  {contract.motiv_incetare !== null ? (
                    <Camp eticheta="Motivul încetării" valoare={contract.motiv_incetare} />
                  ) : null}
                </dl>
                {contract.status === "activ" && can(permisiuni, "employees:update", "all") ? (
                  <FormularInceteazaContract contractId={contract.id} />
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {contractPrincipal === null
          ? can(permisiuni, "employees:create", "all")
            ? <FormularContractNou employeeId={angajat.id} />
            : null
          : can(permisiuni, "employees:update", "all")
            ? (
                <FormularModificaSalariu
                  contractId={contractPrincipal.id}
                  salariuActual={contractPrincipal.salariu_baza}
                />
              )
            : null}
      </section>

      <section
        aria-labelledby="titlu-documente"
        className="rounded-lg border border-border p-4"
      >
        <h2 id="titlu-documente" className="mb-4 text-lg font-medium">
          Documente
        </h2>
        {angajat.documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nu există documente încărcate pentru acest angajat.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {angajat.documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="font-medium">{document.titlu}</span>
                {document.confidential ? (
                  <span className="rounded bg-warning/12 px-2 py-0.5 text-xs text-foreground">
                    Confidențial
                  </span>
                ) : null}
                <span className="ml-auto text-muted-foreground">
                  {document.data_document === null ? "—" : formatDate(document.data_document)}
                  {document.valabil_pana !== null
                    ? ` · expiră ${formatDate(document.valabil_pana)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {rezumatSensibil !== null ? (
        <DateSensibile
          employeeId={angajat.id}
          cnpUltimele4={rezumatSensibil.cnp_last4}
          ibanUltimele4={rezumatSensibil.iban_last4}
          banca={rezumatSensibil.banca}
        />
      ) : null}
    </main>
  );
}
