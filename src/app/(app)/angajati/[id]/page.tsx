// src/app/(app)/angajati/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ChevronRight, FileText, Pencil } from "lucide-react";

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
import { createServerSupabase } from "@/lib/supabase/server";
import {
  citesteAngajat,
  citesteComponenteSalariale,
  citesteEvaluari,
  citesteRezumatDateSensibile,
  citesteScutiriFiscale,
  idFisaProprie,
  lantulDeManageri,
  type CriteriuSablonEvaluare,
} from "@/lib/queries/employees";

import {
  CLASE_STATUS,
  ETICHETE_CONTRACT,
  ETICHETE_MOD_LUCRU,
  ETICHETE_SCUTIRE,
  ETICHETE_STATUS,
} from "../etichete";
import { ButonIncheieComponenta } from "./buton-incheie-componenta";
import { DateSensibile } from "./date-sensibile";
import { FormularContractNou } from "./formular-contract-nou";
import { FormularComponentaSalariala } from "./formular-componenta-salariala";
import { FormularEvaluareNoua } from "./formular-evaluare-noua";
import { FormularInceteazaContract } from "./formular-inceteaza-contract";
import { FormularModificaSalariu } from "./formular-modifica-salariu";
import { FormularScutireFiscala } from "./formular-scutire-fiscala";
import { IncarcareAvatarAdmin } from "./incarcare-avatar-admin";
import { SectiuneConcedii } from "./sectiune-concedii";

const ETICHETE_TIP_COMPONENTA: Readonly<Record<string, string>> = {
  spor_procent: "Spor procentual",
  spor_suma: "Spor — sumă fixă",
  indemnizatie: "Indemnizație",
  prima_recurenta: "Primă recurentă",
  beneficiu_natura: "Beneficiu în natură",
};

export const metadata: Metadata = { title: "Fișa angajatului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

const CLASA_SECTIUNE = "rounded-lg border border-border bg-surface p-5 shadow-sm";

function Camp({
  eticheta,
  valoare,
}: {
  readonly eticheta: string;
  readonly valoare: string | null;
}) {
  const gol = valoare === null || valoare.length === 0;
  return (
    <div>
      <dt className="text-muted-foreground text-xs tracking-wide uppercase">{eticheta}</dt>
      <dd className={`mt-0.5 text-sm ${gol ? "text-muted-foreground/70 italic" : ""}`}>
        {gol ? "Necompletat" : valoare}
      </dd>
    </div>
  );
}

function GrupCampuri({
  titlu,
  children,
}: {
  readonly titlu: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="border-border border-t pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
        {titlu}
      </h3>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</dl>
    </div>
  );
}

function StareGoala({ mesaj }: { readonly mesaj: string }) {
  return (
    <p className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-4 text-center text-sm">
      {mesaj}
    </p>
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
  const scutiriFiscale =
    scope === "all" ? await citesteScutiriFiscale(tenant.organizationId, id) : [];
  const poateAdaugaScutire = can(permisiuni, "payroll:create", "all");
  const componenteSalariale =
    scope === "all" ? await citesteComponenteSalariale(tenant.organizationId, id) : [];
  const poateAdaugaComponenta = can(permisiuni, "payroll:create", "all");
  const evaluari = await citesteEvaluari(tenant.organizationId, id);
  const poateCreaEvaluare = can(permisiuni, "employees:update", "team");
  const sabloaneEvaluare = poateCreaEvaluare
    ? await (async () => {
        const db = await createServerSupabase();
        const { data } = await db
          .from("evaluation_templates")
          .select("id, denumire, criterii")
          .or(`organization_id.eq.${tenant.organizationId},organization_id.is.null`)
          .eq("activ", true)
          .is("deleted_at", null)
          .order("denumire")
          .returns<
            { id: string; denumire: string; criterii: CriteriuSablonEvaluare[] }[]
          >();
        return data ?? [];
      })()
    : [];
  const sabloaneComponente =
    scope === "all" && poateAdaugaComponenta
      ? await (async () => {
          const db = await createServerSupabase();
          const { data } = await db
            .from("salary_component_types")
            .select("id, denumire, kind")
            .or(`organization_id.eq.${tenant.organizationId},organization_id.is.null`)
            .eq("activ", true)
            .is("deleted_at", null)
            .order("denumire");
          return data ?? [];
        })()
      : [];
  const contractPrincipal =
    angajat.contracts.find((c) => !c.este_act_aditional && c.status === "activ") ?? null;
  const contracteIstoric = angajat.contracts.filter((c) => c.id !== contractPrincipal?.id);
  const lantManageri = await lantulDeManageri(
    tenant.organizationId,
    angajat.manager_path,
    angajat.id,
  );
  const esteFisaProprie = angajat.user_id === utilizator.id;
  const poateIncarcaPtOricine = can(permisiuni, "users:update", "all");
  const poateEditaAngajat = can(permisiuni, "employees:update", "all");
  const poateVedeaRegulileConcediu = can(permisiuni, "leave:read", "all");

  return (
    <main className="space-y-6 p-6">
      <header className={CLASA_SECTIUNE}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-start gap-4">
            {esteFisaProprie ? (
              <IncarcareAvatar
                urlInitial={angajat.avatar_url}
                nume={angajat.full_name}
                pregateste={pregatesteIncarcareAvatarulPropriu}
                salveaza={salveazaAvatarulPropriu}
              />
            ) : poateIncarcaPtOricine && angajat.user_id !== null ? (
              <IncarcareAvatarAdmin
                employeeId={angajat.id}
                urlInitial={angajat.avatar_url}
                nume={angajat.full_name}
              />
            ) : (
              <AvatarAngajat url={angajat.avatar_url} nume={angajat.full_name} marime="lg" />
            )}

            <div>
              <h1 className="text-2xl font-semibold">{angajat.full_name}</h1>
              <p className="text-muted-foreground text-sm">
                Marca <span className="font-mono">{angajat.marca}</span>
                {angajat.job_position !== null ? ` · ${angajat.job_position.denumire}` : ""}
                {angajat.department !== null ? ` · ${angajat.department.denumire}` : ""}
              </p>
              {poateIncarcaPtOricine && angajat.user_id === null ? (
                <p className="text-muted-foreground mt-1 text-xs italic">
                  Fără cont în portal — nu i se poate atașa o fotografie.
                </p>
              ) : null}

              {lantManageri.length > 0 ? (
                <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                  {lantManageri.map((veriga) => (
                    <li key={veriga.id} className="flex items-center gap-1.5">
                      <Link
                        href={`/angajati/${veriga.id}`}
                        className="border-border bg-background hover:border-primary/30 hover:bg-primary/5 inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1 transition-colors"
                      >
                        <AvatarAngajat
                          url={veriga.avatar_url}
                          nume={veriga.full_name}
                          marime="sm"
                        />
                        <span className="font-medium">{veriga.full_name}</span>
                      </Link>
                      <ChevronRight
                        aria-hidden="true"
                        className="text-muted-foreground size-4 shrink-0"
                      />
                    </li>
                  ))}
                  <li className="border-primary/30 bg-primary/5 inline-flex items-center gap-1.5 rounded-full border py-1 pr-3 pl-1">
                    <AvatarAngajat url={angajat.avatar_url} nume={angajat.full_name} marime="sm" />
                    <span className="text-primary font-semibold">{angajat.full_name}</span>
                  </li>
                </ol>
              ) : angajat.manager_path.length > 1 ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Lanțul de manageri nu a putut fi determinat.
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {poateEditaAngajat ? (
              <Link
                href={`/angajati/${angajat.id}/editeaza`}
                className="border-border bg-background hover:bg-surface inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
              >
                <Pencil aria-hidden="true" className="size-3.5" />
                Editează fișa
              </Link>
            ) : null}
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${CLASE_STATUS[angajat.status]}`}
            >
              {ETICHETE_STATUS[angajat.status]}
            </span>
          </div>
        </div>
      </header>

      <section aria-labelledby="titlu-date-personale" className={CLASA_SECTIUNE}>
        <h2 id="titlu-date-personale" className="mb-4 text-lg font-medium">
          Date personale
        </h2>
        <div className="space-y-4">
          <GrupCampuri titlu="Identitate">
            <Camp eticheta="Nume" valoare={angajat.last_name} />
            <Camp eticheta="Prenume" valoare={angajat.first_name} />
            <Camp
              eticheta="Data nașterii"
              valoare={angajat.data_nasterii === null ? null : formatDate(angajat.data_nasterii)}
            />
            <Camp eticheta="Cetățenie" valoare={angajat.cetatenie} />
            <Camp
              eticheta="Angajat din"
              valoare={angajat.hired_on === null ? null : formatDate(angajat.hired_on)}
            />
          </GrupCampuri>
          <GrupCampuri titlu="Contact">
            <Camp eticheta="E-mail personal" valoare={angajat.email_personal} />
            <Camp eticheta="Telefon" valoare={angajat.telefon} />
            <Camp
              eticheta="Adresă"
              valoare={[angajat.adresa_strada, angajat.adresa_oras, angajat.adresa_judet]
                .filter((v) => v !== null)
                .join(", ")}
            />
            <Camp
              eticheta="Contact de urgență"
              valoare={[angajat.contact_urgenta_nume, angajat.contact_urgenta_telefon]
                .filter((v) => v !== null)
                .join(" · ")}
            />
          </GrupCampuri>
          <GrupCampuri titlu="Situație personală">
            <Camp
              eticheta="Persoane în întreținere"
              valoare={String(angajat.nr_persoane_intretinere)}
            />
            <Camp eticheta="Grad de handicap" valoare={angajat.grad_handicap} />
          </GrupCampuri>
        </div>
      </section>

      <section aria-labelledby="titlu-contracte" className={CLASA_SECTIUNE}>
        <h2 id="titlu-contracte" className="mb-4 text-lg font-medium">
          Contracte
        </h2>
        {angajat.contracts.length === 0 ? (
          <StareGoala mesaj="Fișa nu are încă niciun contract. Adăugați contractul individual de muncă înainte de transmiterea în REVISAL." />
        ) : (
          <div className="space-y-3">
            {contractPrincipal === null ? (
              <StareGoala mesaj="Niciun contract activ momentan." />
            ) : (
              <div className="border-primary/25 bg-primary/5 rounded-md border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Contract nr. {contractPrincipal.numar}</span>
                  <span className="bg-success/12 text-success rounded-full px-2 py-0.5 text-xs font-medium">
                    {ETICHETE_CONTRACT[contractPrincipal.status] ?? contractPrincipal.status}
                  </span>
                  {contractPrincipal.este_act_aditional ? (
                    <span className="bg-background rounded-full px-2 py-0.5 text-xs">
                      Act adițional
                    </span>
                  ) : null}
                </div>
                <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Camp
                    eticheta="Valabil"
                    valoare={`${formatDate(contractPrincipal.valabil_de_la)} – ${contractPrincipal.valabil_pana === null ? "nedeterminat" : formatDate(contractPrincipal.valabil_pana)}`}
                  />
                  <Camp
                    eticheta="Normă"
                    valoare={`${String(contractPrincipal.norma_ore_saptamana)} ore/săptămână`}
                  />
                  <Camp
                    eticheta="Salariu de bază"
                    valoare={formatLei(contractPrincipal.salariu_baza)}
                  />
                  <Camp
                    eticheta="Mod de lucru"
                    valoare={
                      ETICHETE_MOD_LUCRU[contractPrincipal.work_mode] ?? contractPrincipal.work_mode
                    }
                  />
                </dl>
                {poateEditaAngajat ? (
                  <div className="mt-3">
                    <FormularInceteazaContract contractId={contractPrincipal.id} />
                  </div>
                ) : null}
              </div>
            )}

            {contracteIstoric.length > 0 ? (
              <details className="group">
                <summary className="text-muted-foreground flex cursor-pointer list-none items-center gap-1.5 text-sm [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3.5 shrink-0 transition-transform group-open:rotate-90"
                  />
                  Istoric contracte și acte adiționale ({contracteIstoric.length})
                </summary>
                <ul className="border-border mt-2 space-y-2 border-l-2 pl-4">
                  {contracteIstoric.map((contract) => (
                    <li key={contract.id} className="border-border rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">Contract nr. {contract.numar}</span>
                        {contract.este_act_aditional ? (
                          <span className="bg-surface rounded-full px-2 py-0.5 text-xs">
                            Act adițional
                          </span>
                        ) : null}
                        <span className="text-muted-foreground ml-auto text-xs">
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
                        <Camp
                          eticheta="Salariu de bază"
                          valoare={formatLei(contract.salariu_baza)}
                        />
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
                      {contract.status === "activ" && poateEditaAngajat ? (
                        <div className="mt-3">
                          <FormularInceteazaContract contractId={contract.id} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        )}

        <div className="mt-4">
          {contractPrincipal === null ? (
            can(permisiuni, "employees:create", "all") ? (
              <FormularContractNou employeeId={angajat.id} />
            ) : null
          ) : poateEditaAngajat ? (
            <FormularModificaSalariu
              contractId={contractPrincipal.id}
              salariuActual={contractPrincipal.salariu_baza}
            />
          ) : null}
        </div>
      </section>

      <SectiuneConcedii
        organizationId={tenant.organizationId}
        employeeId={angajat.id}
        hiredOn={angajat.hired_on}
        dataNasterii={angajat.data_nasterii}
        conditiiMunca={angajat.conditii_munca}
        gradHandicap={angajat.grad_handicap}
        departmentId={angajat.department?.id ?? null}
        jobPositionId={angajat.job_position?.id ?? null}
        poateVedeaRegulile={poateVedeaRegulileConcediu}
      />

      {scope === "all" ? (
        <section aria-labelledby="titlu-scutiri" className={CLASA_SECTIUNE}>
          <h2 id="titlu-scutiri" className="mb-4 text-lg font-medium">
            Scutiri fiscale
          </h2>
          {scutiriFiscale.length === 0 ? (
            <StareGoala mesaj="Angajatul nu are nicio scutire fiscală înregistrată." />
          ) : (
            <ul className="space-y-3">
              {scutiriFiscale.map((scutire) => (
                <li key={scutire.id} className="border-border rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {ETICHETE_SCUTIRE[scutire.exemption_type as keyof typeof ETICHETE_SCUTIRE] ??
                        scutire.exemption_type}
                    </span>
                    {scutire.procent_scutire === null ? (
                      <span className="bg-warning/12 rounded-full px-2 py-0.5 text-xs font-medium">
                        Fără procent — nu se aplică automat
                      </span>
                    ) : (
                      <span className="bg-success/12 text-success rounded-full px-2 py-0.5 text-xs font-medium">
                        {scutire.procent_scutire}%
                      </span>
                    )}
                  </div>
                  <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Camp
                      eticheta="Valabil"
                      valoare={`${formatDate(scutire.valabil_de_la)} – ${scutire.valabil_pana === null ? "nedeterminat" : formatDate(scutire.valabil_pana)}`}
                    />
                    <Camp
                      eticheta="Plafon lunar"
                      valoare={
                        scutire.plafon_lunar === null ? null : formatLei(scutire.plafon_lunar)
                      }
                    />
                    <Camp eticheta="Temei legal" valoare={scutire.temei_legal} />
                  </dl>
                </li>
              ))}
            </ul>
          )}
          {poateAdaugaScutire ? (
            <div className="mt-4">
              <FormularScutireFiscala employeeId={angajat.id} />
            </div>
          ) : null}
        </section>
      ) : null}

      {scope === "all" ? (
        <section aria-labelledby="titlu-componente" className={CLASA_SECTIUNE}>
          <h2 id="titlu-componente" className="mb-4 text-lg font-medium">
            Sporuri și prime
          </h2>
          {componenteSalariale.length === 0 ? (
            <StareGoala mesaj="Angajatul nu are niciun spor sau primă asociat(ă)." />
          ) : (
            <ul className="space-y-3">
              {componenteSalariale.map((componenta) => {
                const activa =
                  componenta.valabil_pana === null ||
                  componenta.valabil_pana >= new Date().toISOString().slice(0, 10);
                return (
                  <li key={componenta.id} className="border-border rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {componenta.component_type?.denumire ??
                          ETICHETE_TIP_COMPONENTA[componenta.kind] ??
                          componenta.kind}
                      </span>
                      <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
                        {componenta.procent !== null
                          ? `${String(componenta.procent)}%`
                          : formatLei(componenta.suma ?? 0)}
                      </span>
                      {!activa ? (
                        <span className="bg-background text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                          Încheiată
                        </span>
                      ) : null}
                      {activa && poateAdaugaComponenta ? (
                        <span className="ml-auto">
                          <ButonIncheieComponenta id={componenta.id} employeeId={angajat.id} />
                        </span>
                      ) : null}
                    </div>
                    <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <Camp
                        eticheta="Valabil"
                        valoare={`${formatDate(componenta.valabil_de_la)} – ${componenta.valabil_pana === null ? "nedeterminat" : formatDate(componenta.valabil_pana)}`}
                      />
                      <Camp eticheta="Observații" valoare={componenta.observatii} />
                    </dl>
                  </li>
                );
              })}
            </ul>
          )}
          {poateAdaugaComponenta ? (
            <div className="mt-4">
              <FormularComponentaSalariala employeeId={angajat.id} sabloane={sabloaneComponente} />
            </div>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="titlu-evaluari" className={CLASA_SECTIUNE}>
        <h2 id="titlu-evaluari" className="mb-4 text-lg font-medium">
          Evaluări
        </h2>
        {evaluari.length === 0 ? (
          <StareGoala mesaj="Angajatul nu are nicio evaluare înregistrată." />
        ) : (
          <ul className="space-y-3">
            {evaluari.map((evaluare) => {
              const criteriiDupaCod = new Map(
                (evaluare.template?.criterii ?? []).map((c) => [c.cod, c]),
              );
              return (
                <li key={evaluare.id} className="border-border rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {evaluare.template?.denumire ?? "Șablon șters"}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      {formatDate(evaluare.data_evaluarii)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        evaluare.status === "finalizat"
                          ? "bg-success/12 text-success"
                          : "bg-background text-muted-foreground"
                      }`}
                    >
                      {evaluare.status === "finalizat" ? "Finalizată" : "Ciornă"}
                    </span>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-2 text-xs">
                    {evaluare.raspunsuri.map((raspuns) => {
                      const criteriu = criteriiDupaCod.get(raspuns.criteriu_cod);
                      return (
                        <li key={raspuns.criteriu_cod} className="bg-background rounded-full px-2 py-1">
                          {criteriu?.denumire ?? raspuns.criteriu_cod}: {raspuns.scor}
                          {criteriu !== undefined ? `/${String(criteriu.scala_max)}` : ""}
                        </li>
                      );
                    })}
                  </ul>
                  {evaluare.concluzie !== null ? (
                    <p className="text-muted-foreground mt-2 text-sm">{evaluare.concluzie}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {poateCreaEvaluare ? (
          <FormularEvaluareNoua employeeId={angajat.id} sabloane={sabloaneEvaluare} />
        ) : null}
      </section>

      <section aria-labelledby="titlu-documente" className={CLASA_SECTIUNE}>
        <h2 id="titlu-documente" className="mb-4 text-lg font-medium">
          Documente
        </h2>
        {angajat.documents.length === 0 ? (
          <StareGoala mesaj="Nu există documente încărcate pentru acest angajat." />
        ) : (
          <ul className="divide-border divide-y text-sm">
            {angajat.documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <FileText aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 font-medium">{document.titlu}</span>
                {document.confidential ? (
                  <span className="bg-warning/12 text-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                    Confidențial
                  </span>
                ) : null}
                <span className="text-muted-foreground shrink-0">
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
