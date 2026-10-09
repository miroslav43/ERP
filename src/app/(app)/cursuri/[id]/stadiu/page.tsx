// src/app/(app)/cursuri/[id]/stadiu/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Users } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Indicator } from "@/components/ui/indicator";
import { Nivel } from "@/components/ui/nivel";
import { Scadenta } from "@/components/ui/scadenta";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { filtreDinUrl, idDinRuta } from "@/lib/rute/parametri";
import { filtreInrolariSchema } from "@/schemas/cursuri";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { citesteCurs, listeazaInrolari, numeAngajati } from "@/lib/queries/cursuri";
import { textProgres, treaptaTermen } from "@/domain/cursuri/scadente";

import { ETICHETE_MOTIV, ETICHETE_STATUS, TONURI_STATUS } from "../../etichete";
import { AnulareInrolare } from "./anulare-inrolare";
import { LinkEntitate } from "@/components/ui/link-entitate";
import { hrefFisa } from "@/lib/navigare/fisa";
import Link from "next/link";
import { buton } from "@/components/ui/buton";
import { PastileFiltre } from "@/components/ui/pastile-filtre";

export const metadata: Metadata = { title: "Stadiul cursului" };

export default async function PaginaStadiu({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly id: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const parametri = await searchParams;
  const cursId = idDinRuta(id);

  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "courses"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta stadiul cursurilor." />;
  }

  const curs = await citesteCurs(tenant.organizationId, cursId);
  if (curs === null) notFound();

  const poateEdita = can(permisiuni, "courses:update", "team");
  const poateAtribui = can(permisiuni, "courses:create", "team");

  // Filtrele vin din URL, ca indicatorii să poată trimite în lista DEJA
  // filtrată. `filtreDinUrl` cade pe implicit la orice intrare stricată.
  const filtre = filtreDinUrl(filtreInrolariSchema, parametri);
  const { randuri } = await listeazaInrolari(tenant.organizationId, {
    ...filtre,
    curs: cursId,
    limita: 50,
  });
  // Indicatorii se sprijină pe TOTALURI din bază, nu pe lista filtrată și
  // tăiată la 50: pe `?status=finalizat`, „Înrolări" arăta doar finalizații.
  const baza = { ...filtreInrolariSchema.parse({}), curs: cursId, limita: 5 };
  const [totaluri, totalFinalizate, totalRestante] = await Promise.all([
    listeazaInrolari(tenant.organizationId, baza).then((r) => r.total),
    listeazaInrolari(tenant.organizationId, { ...baza, status: "finalizat" }).then((r) => r.total),
    listeazaInrolari(tenant.organizationId, { ...baza, doar_restante: "da" }).then((r) => r.total),
  ]);
  const nume = await numeAngajati(
    tenant.organizationId,
    randuri.map((r) => r.employee_id),
  );

  const azi = todayInBucharest();
  const parcurse = totalFinalizate;
  const restante = totalRestante;

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "angajat",
      antet: "Persoană",
      peTelefon: "titlu",
      celula: (r) => {
        const angajat = nume.get(r.employee_id);
        return (
          <LinkEntitate
            href={hrefFisa(
              angajat === undefined ? null : { id: r.employee_id, deleted_at: angajat.deleted_at },
              permisiuni,
            )}
            className="font-medium"
            clasaText="font-medium"
          >
            {angajat?.nume ?? "—"}
          </LinkEntitate>
        );
      },
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (r) => (
        <>
          <Badge ton={TONURI_STATUS[r.status]}>{ETICHETE_STATUS[r.status]}</Badge>
          {/* Adeverința există din momentul finalizării (`course_completion_records`);
              ruta se sprijină pe RLS, deci se deschide și din aplicația mare. */}
          {r.status === "finalizat" ? (
            <a
              href={`/portal/cursurile-mele/${r.id}/adeverinta`}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground text-nota relative ml-2 underline-offset-2 hover:underline"
            >
              Adeverință
            </a>
          ) : null}
        </>
      ),
    },
    {
      cheie: "progres",
      antet: "Lecții",
      peTelefon: "meta",
      celula: (r) => (
        <Nivel
          marime="subtire"
          valoare={r.materiale_finalizate}
          din={Math.max(1, r.materiale_total)}
          eticheta="Lecții parcurse"
          // `aria-valuetext` în CUVINTE, nu procent: pe patru lecții, „75 %”
          // sună precis și nu e.
          text={`${String(r.materiale_finalizate)} din ${String(r.materiale_total)} lecții`}
          ton={r.materiale_finalizate === r.materiale_total ? "bun" : "neutru"}
        />
      ),
    },
    {
      cheie: "termen",
      antet: "Termen",
      peTelefon: "meta",
      celula: (r) => (
        <Scadenta treapta={treaptaTermen(r.termen, azi, r.status)}>
          {r.termen === null ? "Fără termen" : formatDate(r.termen)}
        </Scadenta>
      ),
    },
    {
      cheie: "motiv",
      antet: "Motiv",
      peTelefon: "ascuns",
      // Înrolarea din regulă duce la regulile cursului (aceeași poartă ca stadiul).
      celula: (r) =>
        r.motiv === "regula" ? (
          <Link
            href={`/cursuri/${cursId}/reguli`}
            className="relative underline-offset-2 hover:underline"
          >
            {ETICHETE_MOTIV[r.motiv]}
          </Link>
        ) : (
          ETICHETE_MOTIV[r.motiv]
        ),
    },
    // Coloana apare doar pentru cine chiar poate anula: un buton stins pe
    // fiecare rând, pentru un rol care n-are dreptul, e zgomot pe toată lista.
    ...(poateEdita
      ? [
          {
            cheie: "anulare",
            antet: "Anulează",
            latime: "ingusta" as const,
            peTelefon: "meta" as const,
            celula: (r: (typeof randuri)[number]) => (
              <AnulareInrolare
                inrolareId={r.id}
                numeAngajat={nume.get(r.employee_id)?.nume ?? "această persoană"}
                status={r.status}
              />
            ),
          },
        ]
      : []),
  ];

  return (
    <div className={`${LATIMI.lista} space-y-6`}>
      <AntetPagina
        titlu="Stadiu"
        descriere={`Cine a parcurs „${curs.denumire}” și cine nu.`}
        firimituri={[
          { eticheta: "Cursuri", href: "/cursuri" },
          { eticheta: curs.denumire, href: `/cursuri/${cursId}` },
          { eticheta: "Stadiu" },
        ]}
        {...(poateAtribui && curs.publicat
          ? {
              actiuni: (
                <Link
                  href={`/cursuri/${cursId}/atribuire`}
                  className={buton({ varianta: "primar" })}
                >
                  Atribuie
                </Link>
              ),
            }
          : {})}
      />

      {/* Filtrele venite din indicatori sau din fișa angajatului, ca pastile cu „×". */}
      <PastileFiltre
        active={[
          ...(filtre.status == null
            ? []
            : [{ cheie: "status", eticheta: `Stare: ${ETICHETE_STATUS[filtre.status]}` }]),
          ...(filtre.doar_restante === "da"
            ? [{ cheie: "doar_restante", eticheta: "Doar restanții" }]
            : []),
          ...(filtre.angajat == null
            ? []
            : [
                {
                  cheie: "angajat",
                  eticheta: `Angajat: ${nume.get(filtre.angajat)?.nume ?? "ales"}`,
                },
              ]),
        ]}
      />

      {/*
        Cifre ABSOLUTE, cu `href` către lista deja filtrată. Sub 25 de persoane
        procentul e o minciună cu zecimale: un singur om mută „conformitatea” cu
        peste zece puncte.
      */}
      <section aria-label="Rezumat" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/*
          `href` pe fiecare cifră: `indicator.tsx:17-21` scrie că e aproape
          obligatoriu — „o cifră fără drum e o fundătură". Filtrele există deja
          în `filtreInrolariSchema` și nu erau legate de nimic.
        */}
        <Indicator
          eticheta="Au parcurs"
          valoare={textProgres(parcurse, totaluri, "persoane")}
          esteCuvant
          ton={parcurse === totaluri && totaluri > 0 ? "bun" : "neutru"}
          {...(parcurse > 0 ? { href: `/cursuri/${cursId}/stadiu?status=finalizat` } : {})}
        />
        <Indicator
          eticheta="Restanți"
          valoare={String(restante)}
          {...(restante > 0 ? { href: `/cursuri/${cursId}/stadiu?doar_restante=da` } : {})}
          ton={restante === 0 ? "bun" : "atentie"}
          nota={restante === 0 ? "Nimeni peste termen." : "Peste termenul de parcurgere."}
          {...(restante > 0 ? { href: `/cursuri/${cursId}/stadiu?doar_restante=da` } : {})}
        />
        <Indicator
          eticheta="Înrolări"
          valoare={String(totaluri)}
          {...(totaluri > 0 ? { href: `/cursuri/${cursId}/stadiu` } : {})}
        />
      </section>

      <Tabel
        caption="Înrolările la acest curs, cu progresul fiecărei persoane."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(r) => r.id}
        gol={
          <StareGoala
            fel="initiala"
            pictograma={Users}
            titlu="Nimeni nu are încă acest curs"
            descriere={
              curs.publicat
                ? "Atribuiți-l unei persoane ca să apară aici."
                : "Cursul e în ciornă. Publicați-l din pagina cursului, apoi îl puteți atribui."
            }
            {...(curs.publicat
              ? can(permisiuni, "courses:create", "team")
                ? { actiune: { eticheta: "Atribuie cursul", href: `/cursuri/${cursId}/atribuire` } }
                : {}
              : // Un curs nepublicat nu se poate atribui, dar tăcerea de dinainte
                // lăsa omul fără nimic de apăsat ȘI fără explicație.
                { actiune: { eticheta: "Publicați cursul întâi", href: `/cursuri/${cursId}` } })}
          />
        }
      />
    </div>
  );
}
