// src/app/(platform)/super-admin/organizatii/[orgId]/page.tsx
import Link from "next/link";
import { SlidersHorizontal, UserPlus } from "lucide-react";
import { notFound } from "next/navigation";

import { buton } from "@/components/ui/buton";
import { cn } from "@/lib/ui/cn";
import { formatDateTime } from "@/lib/format/date";
import { formateazaCui } from "@/domain/organization/cui";
import {
  InsignaPlan,
  InsignaStatus,
  type PlanOrganizatie,
  type StatusOrganizatie,
} from "../../_components/insigne";
import { ActiuniOrganizatie } from "./_components/actiuni-organizatie";
import { FormularEditeazaOrganizatie } from "./_components/formular-editeaza-organizatie";
import { fisaOrganizatiei } from "../actions";

const ETICHETE_ROL: Record<string, string> = {
  super_admin: "Super-administrator",
  org_admin: "Administrator",
  manager: "Manager",
  hr: "Resurse umane",
  employee: "Angajat",
};

function Rand({ eticheta, valoare }: { eticheta: string; valoare: string | null }) {
  return (
    <div className="border-border border-b py-2 last:border-0">
      <dt className="text-muted-foreground text-nota tracking-wide uppercase">{eticheta}</dt>
      <dd className="text-foreground text-corp mt-0.5">
        {valoare && valoare.length > 0 ? valoare : "—"}
      </dd>
    </div>
  );
}

export default async function PaginaFisaOrganizatie({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const fisa = await fisaOrganizatiei(orgId);
  if (!fisa) notFound();

  const { organizatie, membri, module, membriActivi, invitatiiInAsteptare } = fisa;
  const moduleActive = module.filter((modul) => modul.activ);

  return (
    <div className="space-y-6">
      <nav aria-label="Firimituri" className="text-corp">
        <Link
          href="/super-admin/organizatii"
          className="text-primary underline-offset-4 hover:underline"
        >
          Organizații
        </Link>
        <span aria-hidden="true" className="text-muted-foreground mx-2">
          /
        </span>
        <span className="text-muted-foreground">{organizatie.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-titlu font-semibold">{organizatie.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <InsignaStatus status={organizatie.status as StatusOrganizatie} />
            <InsignaPlan plan={organizatie.plan as PlanOrganizatie} />
            <span className="text-muted-foreground text-corp">/{organizatie.slug}</span>
          </div>
        </div>
        <ActiuniOrganizatie
          orgId={organizatie.id}
          status={organizatie.status as StatusOrganizatie}
          membriActivi={membriActivi}
        />
      </header>

      {organizatie.status === "suspended" && organizatie.suspended_reason && (
        <p
          role="status"
          className="border-border bg-surface text-danger rounded-control text-corp border p-3"
        >
          Suspendată la{" "}
          {organizatie.suspended_at ? formatDateTime(new Date(organizatie.suspended_at)) : "—"}.
          Motiv: {organizatie.suspended_reason}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="titlu-date" className="border-border rounded-panou border p-4">
          <h2
            id="titlu-date"
            className="text-muted-foreground text-corp mb-2 font-medium tracking-wide uppercase"
          >
            Date de identificare
          </h2>
          <dl>
            <Rand eticheta="Denumire legală" valoare={organizatie.legal_name ?? organizatie.name} />
            <Rand eticheta="Formă juridică" valoare={organizatie.forma_juridica} />
            <Rand
              eticheta="CUI"
              valoare={formateazaCui(organizatie.cui, organizatie.platitor_tva)}
            />
            <Rand eticheta="Registrul comerțului" valoare={organizatie.reg_com} />
            <Rand
              eticheta="Sediu"
              valoare={[organizatie.adresa, organizatie.oras, organizatie.judet]
                .filter(Boolean)
                .join(", ")}
            />
            <Rand
              eticheta="Contact"
              valoare={`${organizatie.email_contact} · ${organizatie.telefon_contact}`}
            />
            <Rand eticheta="Creată la" valoare={formatDateTime(organizatie.created_at)} />
            <Rand
              eticheta="Activată la"
              valoare={organizatie.activated_at ? formatDateTime(organizatie.activated_at) : null}
            />
          </dl>
          <div className="mt-4">
            <FormularEditeazaOrganizatie
              organizatie={{
                orgId: organizatie.id,
                name: organizatie.name,
                legal_name: organizatie.legal_name,
                email_contact: organizatie.email_contact,
                telefon_contact: organizatie.telefon_contact,
                judet: organizatie.judet,
                oras: organizatie.oras,
                adresa: organizatie.adresa,
                cod_postal: organizatie.cod_postal,
                website: organizatie.website,
                reprezentant_legal: organizatie.reprezentant_legal,
                plan: organizatie.plan,
                seats_limit: organizatie.seats_limit,
                zile_concediu_anual_implicit: organizatie.zile_concediu_anual_implicit,
                forma_juridica: organizatie.forma_juridica,
                cod_caen: organizatie.cod_caen,
                cod_caen_secundare: organizatie.cod_caen_secundare,
              }}
            />
          </div>
        </section>

        <section
          aria-labelledby="titlu-abonament"
          className="border-border rounded-panou border p-4"
        >
          <h2
            id="titlu-abonament"
            className="text-muted-foreground text-corp mb-2 font-medium tracking-wide uppercase"
          >
            Abonament
          </h2>
          <dl>
            <Rand eticheta="Plan" valoare={organizatie.plan} />
            <Rand eticheta="Stare abonament" valoare={organizatie.subscription_status} />
            <Rand
              eticheta="Locuri ocupate"
              valoare={`${membriActivi} din ${organizatie.seats_limit}`}
            />
            <Rand eticheta="Invitații în așteptare" valoare={String(invitatiiInAsteptare)} />
            <Rand
              eticheta="Probă până la"
              valoare={organizatie.trial_ends_at ? formatDateTime(organizatie.trial_ends_at) : null}
            />
          </dl>
          {membriActivi >= organizatie.seats_limit && (
            <p role="status" className="text-warning text-corp mt-3">
              Toate locurile sunt ocupate. Invitațiile noi vor fi refuzate până la mărirea limitei.
            </p>
          )}
        </section>

        <section aria-labelledby="titlu-module" className="border-border rounded-panou border p-4">
          <h2
            id="titlu-module"
            className="text-muted-foreground text-corp mb-3 font-medium tracking-wide uppercase"
          >
            Module activate
          </h2>
          {moduleActive.length === 0 ? (
            <p className="text-muted-foreground text-corp">
              Niciun modul activat. Activați cel puțin modulele de bază pentru ca membrii să vadă
              meniul.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {moduleActive.map((modul) => (
                <li
                  key={modul.cheie}
                  className="border-border bg-surface text-foreground rounded-control text-nota border px-2.5 py-1"
                >
                  {modul.denumire}
                </li>
              ))}
            </ul>
          )}
          {/*
            Buton, nu link subliniat: e acțiunea principală a cardului, iar un
            link în corpul textului se citește ca proză, nu ca ceva de apăsat.
          */}
          <Link
            href={`/super-admin/organizatii/${organizatie.id}/module`}
            className={cn(buton({ varianta: "secundar" }), "mt-4")}
          >
            <SlidersHorizontal aria-hidden="true" className="size-4" />
            Gestionează modulele
          </Link>
        </section>

        <section aria-labelledby="titlu-membri" className="border-border rounded-panou border p-4">
          <h2
            id="titlu-membri"
            className="text-muted-foreground text-corp mb-3 font-medium tracking-wide uppercase"
          >
            Membri
          </h2>
          {membri.length === 0 ? (
            <div className="border-border rounded-control flex flex-col items-center gap-1 border border-dashed p-6 text-center">
              <p className="text-foreground text-corp font-medium">
                Organizația nu are încă niciun membru.
              </p>
              <p className="text-muted-foreground text-corp mb-3">
                Până nu are un administrator, nimeni nu poate intra în ea.
              </p>
              {/*
                Buton PRIMAR: pe o organizație goală asta e singura acțiune care
                contează. Ca link subliniat, arăta ca a doua propoziție a mesajului
                de gol — adică exact ca text de citit, nu de apăsat.
              */}
              <Link
                href={`/super-admin/organizatii/${organizatie.id}/membri`}
                className={buton({ varianta: "primar" })}
              >
                <UserPlus aria-hidden="true" className="size-4" />
                Invită administratorul
              </Link>
            </div>
          ) : (
            <ul className="divide-border divide-y">
              {membri.slice(0, 8).map((membru) => (
                <li key={membru.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="text-foreground text-corp block truncate">
                      {membru.nume ?? membru.email ?? "Utilizator"}
                    </span>
                    <span className="text-muted-foreground text-nota block truncate">
                      {membru.email ?? ""}
                    </span>
                  </span>
                  <span className="text-muted-foreground text-nota shrink-0">
                    {ETICHETE_ROL[membru.role] ?? membru.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
