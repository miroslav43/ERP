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
import { idDinRuta } from "@/lib/rute/parametri";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { citesteCurs, listeazaInrolari, numeAngajati } from "@/lib/queries/cursuri";
import { textProgres, treaptaTermen } from "@/domain/cursuri/scadente";

import { ETICHETE_MOTIV, ETICHETE_STATUS, TONURI_STATUS } from "../../etichete";

export const metadata: Metadata = { title: "Stadiul cursului" };

export default async function PaginaStadiu({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const cursId = idDinRuta(id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "courses");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta stadiul cursurilor." />;
  }

  const curs = await citesteCurs(tenant.organizationId, cursId);
  if (curs === null) notFound();

  const { randuri } = await listeazaInrolari(tenant.organizationId, {
    curs: cursId,
    status: null,
    angajat: null,
    doar_restante: null,
    cursor: null,
    limita: 50,
  });
  const nume = await numeAngajati(
    tenant.organizationId,
    randuri.map((r) => r.employee_id),
  );

  const azi = todayInBucharest();
  const parcurse = randuri.filter((r) => r.status === "finalizat").length;
  const restante = randuri.filter(
    (r) =>
      (r.status === "neinceput" || r.status === "in_curs") &&
      r.termen !== null &&
      r.termen < azi,
  ).length;

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "angajat",
      antet: "Persoană",
      peTelefon: "titlu",
      celula: (r) => <span className="font-medium">{nume.get(r.employee_id) ?? "—"}</span>,
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (r) => <Badge ton={TONURI_STATUS[r.status]}>{ETICHETE_STATUS[r.status]}</Badge>,
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
      celula: (r) => ETICHETE_MOTIV[r.motiv],
    },
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
      />

      {/*
        Cifre ABSOLUTE, cu `href` către lista deja filtrată. Sub 25 de persoane
        procentul e o minciună cu zecimale: un singur om mută „conformitatea” cu
        peste zece puncte.
      */}
      <section aria-label="Rezumat" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Indicator
          eticheta="Au parcurs"
          valoare={textProgres(parcurse, randuri.length, "persoane")}
          esteCuvant
          ton={parcurse === randuri.length && randuri.length > 0 ? "bun" : "neutru"}
        />
        <Indicator
          eticheta="Restanți"
          valoare={String(restante)}
          ton={restante === 0 ? "bun" : "atentie"}
          nota={restante === 0 ? "Nimeni peste termen." : "Peste termenul de parcurgere."}
        />
        <Indicator eticheta="Înrolări" valoare={String(randuri.length)} />
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
            descriere="Atribuiți-l unei persoane ca să apară aici."
            {...(curs.publicat
              ? { actiune: { eticheta: "Atribuie cursul", href: `/cursuri/${cursId}/atribuire` } }
              : {})}
          />
        }
      />
    </div>
  );
}
