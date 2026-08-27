// src/app/(app)/cursuri/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { GraduationCap } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { BaraFiltre } from "@/components/ui/bara-filtre";
import { Paginare } from "@/components/ui/paginare";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { buton } from "@/components/ui/buton";
import { clasaControl } from "@/components/ui/camp";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { listeazaCursuri } from "@/lib/queries/cursuri";
import { filtreCursuriSchema } from "@/schemas/cursuri";

import { DESCRIERI, TITLURI } from "./etichete";
import { NavCursuri } from "./nav-cursuri";

export const metadata: Metadata = { title: TITLURI.lista };

type Parametri = Record<string, string | string[] | undefined>;

export default async function PaginaCursuri({
  searchParams,
}: {
  readonly searchParams: Promise<Parametri>;
}) {
  const parametri = await searchParams;
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "courses");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  /*
   * AMBELE ramuri, nu doar `=== "none"`: `getPermissionMap` SCOATE `none` din
   * hartă, deci `scopeFor` întoarce `null` pentru un rol fără permisiune, iar
   * o poartă scrisă doar pe `"none"` l-ar lăsa să treacă spre un ecran gol.
   * Defectul e real în acest repo — vezi `departamente/page.tsx:55-62`.
   */
  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cursurile firmei." />;
  }

  const poateCrea = can(permisiuni, "courses:create", "team");
  const filtre = filtreDinUrl(filtreCursuriSchema, parametri);
  const { randuri, urmatorulCursor, total } = await listeazaCursuri(tenant.organizationId, filtre);

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "denumire",
      antet: "Curs",
      sortabil: true,
      peTelefon: "titlu",
      celula: (c) => (
        <span className="font-medium">
          {c.denumire}
          <span className="text-muted-foreground text-nota ml-1">({c.cod})</span>
        </span>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      peTelefon: "insigna",
      celula: (c) =>
        !c.activ ? (
          <Badge ton="neutru">Dezactivat</Badge>
        ) : c.publicat ? (
          <Badge ton="succes">Publicat</Badge>
        ) : (
          <Badge ton="ciorna">Ciornă</Badge>
        ),
    },
    {
      cheie: "obligatoriu",
      antet: "Obligatoriu",
      peTelefon: "meta",
      celula: (c) => (c.obligatoriu ? "Da" : "Nu"),
    },
    {
      cheie: "valabilitate",
      antet: "Valabilitate",
      peTelefon: "meta",
      celula: (c) =>
        c.valabilitate_luni === null ? (
          <span className="text-muted-foreground">Nu expiră</span>
        ) : (
          `${String(c.valabilitate_luni)} luni`
        ),
    },
    {
      cheie: "termen",
      antet: "Termen",
      numeric: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (c) => `${String(c.termen_zile)} zile`,
    },
  ];

  const href = (peste: Readonly<Record<string, string | null>>): string => {
    const cauta = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries({ ...parametri, ...peste })) {
      if (typeof valoare === "string" && valoare.length > 0) cauta.set(cheie, valoare);
    }
    const text = cauta.toString();
    return text.length === 0 ? "/cursuri" : `/cursuri?${text}`;
  };

  return (
    <div className={`${LATIMI.lista} space-y-6`}>
      <AntetPagina
        titlu={TITLURI.lista}
        descriere={DESCRIERI.lista}
        file={<NavCursuri activ="cursuri" />}
        {...(poateCrea
          ? {
              actiuni: (
                <Link href="/cursuri/nou" className={buton({ varianta: "primar" })}>
                  Curs nou
                </Link>
              ),
            }
          : {})}
      />

      <BaraFiltre
        active={[
          ...(filtre.cauta === null
            ? []
            : [{ cheie: "cauta", eticheta: `Caută: ${filtre.cauta}` }]),
          ...(filtre.doar_publicate === "da"
            ? [{ cheie: "doar_publicate", eticheta: "Doar publicate" }]
            : []),
        ]}
        cheiProprii={["cauta", "doar_publicate"]}
      >
        <label className="flex flex-col gap-1">
          <span className="text-eticheta text-muted-foreground uppercase">Caută</span>
          <input
            type="search"
            name="cauta"
            defaultValue={filtre.cauta ?? ""}
            placeholder="Denumire sau cod"
            className={clasaControl()}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-eticheta text-muted-foreground uppercase">Stare</span>
          <select
            name="doar_publicate"
            defaultValue={filtre.doar_publicate ?? ""}
            className={clasaControl()}
          >
            <option value="">Toate</option>
            <option value="da">Doar publicate</option>
          </select>
        </label>
      </BaraFiltre>

      <Tabel
        caption="Cursurile firmei, cu starea și termenul fiecăruia."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(c) => c.id}
        href={(c) => `/cursuri/${c.id}`}
        gol={
          <StareGoala
            fel={filtre.cauta === null ? "initiala" : "filtrata"}
            pictograma={GraduationCap}
            titlu={filtre.cauta === null ? "Niciun curs" : "Niciun curs găsit"}
            descriere={
              filtre.cauta === null
                ? "Un curs e o listă ordonată de materiale din bibliotecă, pe care o atribuiți apoi angajaților."
                : "Schimbați căutarea sau ștergeți filtrele."
            }
            {...(filtre.cauta === null && poateCrea
              ? { actiune: { eticheta: "Creați primul curs", href: "/cursuri/nou" } }
              : {})}
          />
        }
      />

      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={filtre.limita}
        construiesteHref={({ cursor, limita }) => href({ cursor, limita: String(limita) })}
      />
    </div>
  );
}
