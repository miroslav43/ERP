// src/app/(app)/salarizare/popriri/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Gavel } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { dosarePopriri } from "@/lib/queries/payroll";
import { formatAmount } from "@/lib/format/money";
import { formatDate } from "@/lib/format/date";

import { ActiuniPoprire } from "./actiuni-poprire";
import { FormularPoprireNoua } from "./formular-poprire-noua";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { cn } from "@/lib/ui/cn";

export const metadata: Metadata = { title: "Popriri" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaPopriri({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // `?nou=<id>`: dosarul tocmai deschis, evidențiat pe server și derulat la `#dosar-<id>`.
  const parametri = await searchParams;
  const nouBrut = parametri["nou"];
  const nouId = typeof nouBrut === "string" ? nouBrut : null;
  // `?angajat=<id>`: filtru de INTRARE, de pe fișa angajatului. Lista n-avea
  // nicio adresă pe om, deci de pe fișă nu se putea trimite nimeni la
  // dosarele lui anume (analiza 2026-10-08, salarizare-L14).
  const angajatBrut = parametri["angajat"];
  const angajatFiltrat =
    typeof angajatBrut === "string" && UUID_RE.test(angajatBrut) ? angajatBrut : null;
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "payroll"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // `getPermissionMap` scoate `none` din hartă (`permissions.ts`), iar
  // `scopeFor` întoarce `null` pentru o cheie absentă — comparația doar cu
  // `"none"` nu era NICIODATĂ adevărată, deci poarta nu refuza pe nimeni.
  const scopePopriri = scopeFor(permisiuni, "payroll:read");
  if (scopePopriri === null || scopePopriri === "none") {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta popririle." />;
  }

  const poateCrea = can(permisiuni, "payroll:create", "all");
  const poateEdita = can(permisiuni, "payroll:update", "all");

  const db = await createServerSupabase();
  const [toateDosarele, { data: angajati }] = await Promise.all([
    dosarePopriri(tenant.organizationId),
    db
      .from("employees")
      .select("id, full_name, marca")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "activ")
      .is("deleted_at", null)
      .order("full_name")
      .returns<{ id: string; full_name: string | null; marca: string }[]>(),
  ]);

  const dosare =
    angajatFiltrat === null
      ? toateDosarele
      : toateDosarele.filter((d) => d.employee_id === angajatFiltrat);
  const numeFiltrat =
    angajatFiltrat === null
      ? null
      : (toateDosarele.find((d) => d.employee_id === angajatFiltrat)?.angajat?.full_name ??
        angajati?.find((a) => a.id === angajatFiltrat)?.full_name ??
        "angajatul ales");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Popriri"
        descriere="Dosare de urmărire silită. Reținerea se plafonează automat la o treime din salariul net pentru un singur dosar și la jumătate când sunt mai multe, iar dosarul se închide singur când datoria e stinsă."
        {...(poateCrea ? { actiuni: <FormularPoprireNoua angajati={angajati ?? []} /> } : {})}
      />

      {angajatFiltrat === null ? null : (
        <p className="border-border bg-surface rounded-panou text-corp border px-4 py-2">
          Doar dosarele pentru <strong>{numeFiltrat}</strong>.{" "}
          <Link href="/salarizare/popriri" className="underline underline-offset-2">
            Toate dosarele
          </Link>
          .
        </p>
      )}

      {dosare.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Gavel}
          titlu={
            angajatFiltrat === null
              ? "Niciun dosar de poprire"
              : "Niciun dosar pentru acest angajat"
          }
          descriere={
            angajatFiltrat === null
              ? "Când primiți o adresă de înființare a popririi de la un executor judecătoresc, deschideți aici dosarul — reținerea intră automat în calculul salarial."
              : "Angajatul ales n-are niciun dosar de poprire, activ sau stins."
          }
        />
      ) : (
        <ul className="space-y-3">
          {dosare.map((dosar) => {
            const soldRamas = dosar.sold_ramas ?? dosar.suma_totala - dosar.suma_recuperata;
            const procent =
              dosar.suma_totala > 0
                ? Math.min(100, Math.round((dosar.suma_recuperata / dosar.suma_totala) * 100))
                : 0;
            return (
              <li
                key={dosar.id}
                id={`dosar-${dosar.id}`}
                className={cn(
                  "border-border bg-surface rounded-panou shadow-ridicat scroll-mt-24 border",
                  nouId === dosar.id && "ring-primary ring-2",
                )}
              >
                <div className="flex flex-wrap items-start gap-3 px-4 py-3">
                  <span className="bg-background rounded-control flex size-9 shrink-0 items-center justify-center">
                    <Gavel aria-hidden="true" className="text-primary size-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        <LinkEntitate
                          href={
                            dosar.angajat !== null && can(permisiuni, "employees:read", "all")
                              ? `/angajati/${dosar.employee_id}`
                              : null
                          }
                        >
                          {dosar.angajat?.full_name ?? "—"}
                        </LinkEntitate>
                      </span>
                      <span className="text-muted-foreground text-nota font-mono">
                        {dosar.angajat?.marca ?? ""}
                      </span>
                      <span className="text-muted-foreground text-nota">dosar {dosar.dosar}</span>
                      {dosar.tip_creanta === "intretinere" ? (
                        <span className="bg-primary/10 text-primary text-nota rounded-full px-2 py-0.5 font-medium">
                          Întreținere — prioritate legală
                        </span>
                      ) : null}
                      {dosar.activa ? null : (
                        <span className="bg-background text-muted-foreground text-nota rounded-full px-2 py-0.5 font-medium">
                          {soldRamas <= 0 ? "Stins" : "Închis"}
                        </span>
                      )}
                    </div>

                    <p className="text-muted-foreground text-corp mt-1">
                      {dosar.creditor}
                      {dosar.executor !== null ? ` · executor ${dosar.executor}` : ""} · din{" "}
                      {formatDate(dosar.data_inceput)}
                      {dosar.data_sfarsit !== null
                        ? ` până la ${formatDate(dosar.data_sfarsit)}`
                        : ""}
                    </p>

                    <div className="text-corp mt-2 flex flex-wrap gap-x-6 gap-y-1">
                      <span>
                        Datorie: <strong>{formatAmount(dosar.suma_totala)} lei</strong>
                      </span>
                      <span>
                        Recuperat: <strong>{formatAmount(dosar.suma_recuperata)} lei</strong>
                      </span>
                      <span>
                        Rămas: <strong>{formatAmount(soldRamas)} lei</strong>
                      </span>
                      <span className="text-muted-foreground">
                        rată lunară {formatAmount(dosar.suma_lunara)} lei
                      </span>
                    </div>

                    <div
                      className="bg-background mt-2 h-1.5 w-full overflow-hidden rounded-full"
                      role="progressbar"
                      aria-valuenow={procent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Recuperat ${String(procent)}% din datorie`}
                    >
                      <div className="bg-primary h-full" style={{ width: `${String(procent)}%` }} />
                    </div>
                  </div>
                </div>

                {poateEdita ? (
                  <div className="border-border bg-background border-t px-4 py-2">
                    <ActiuniPoprire id={dosar.id} activa={dosar.activa} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
