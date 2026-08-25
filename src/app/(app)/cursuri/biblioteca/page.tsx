// src/app/(app)/cursuri/biblioteca/page.tsx
import type { Metadata } from "next";
import { Library } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { BaraFiltre } from "@/components/ui/bara-filtre";
import { Paginare } from "@/components/ui/paginare";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { clasaControl } from "@/components/ui/camp";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { listeazaMateriale } from "@/lib/queries/cursuri";
import { filtreMaterialeSchema } from "@/schemas/cursuri";

import { DESCRIERI, ETICHETE_FEL, ETICHETE_SURSA, ETICHETE_TREAPTA, TITLURI } from "../etichete";
import { NavCursuri } from "../nav-cursuri";
import { FormularMaterialNou } from "./formular-material";

export const metadata: Metadata = { title: TITLURI.biblioteca };

type Parametri = Record<string, string | string[] | undefined>;

export default async function PaginaBiblioteca({
  searchParams,
}: {
  readonly searchParams: Promise<Parametri>;
}) {
  const parametri = await searchParams;
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "courses");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta biblioteca de materiale." />;
  }

  const poateCrea = can(permisiuni, "courses:create", "team");
  const filtre = filtreDinUrl(filtreMaterialeSchema, parametri);
  const { randuri, urmatorulCursor, total } = await listeazaMateriale(tenant.organizationId, filtre);

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "titlu",
      antet: "Material",
      sortabil: true,
      peTelefon: "titlu",
      celula: (m) => (
        <span className="font-medium">
          {m.titlu}
          <span className="text-muted-foreground text-nota ml-1">({m.cod})</span>
        </span>
      ),
    },
    {
      cheie: "fel",
      antet: "Fel",
      sortabil: true,
      peTelefon: "insigna",
      celula: (m) => <Badge ton="neutru">{ETICHETE_FEL[m.fel]}</Badge>,
    },
    {
      cheie: "sursa",
      antet: "Sursă",
      peTelefon: "meta",
      celula: (m) => ETICHETE_SURSA[m.sursa],
    },
    {
      cheie: "treapta",
      antet: "Dovadă",
      peTelefon: "meta",
      celula: (m) => ETICHETE_TREAPTA[m.treapta_dovada],
    },
    {
      cheie: "continut",
      antet: "Conținut",
      peTelefon: "insigna",
      celula: (m) =>
        m.versiune_curenta_id === null ? (
          <Badge ton="pericol" cuAvertisment>
            Lipsă
          </Badge>
        ) : (
          <Badge ton="succes">Încărcat</Badge>
        ),
    },
  ];

  const href = (peste: Readonly<Record<string, string | null>>): string => {
    const cauta = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries({ ...parametri, ...peste })) {
      if (typeof valoare === "string" && valoare.length > 0) cauta.set(cheie, valoare);
    }
    const text = cauta.toString();
    return text.length === 0 ? "/cursuri/biblioteca" : `/cursuri/biblioteca?${text}`;
  };

  return (
    <div className={`${LATIMI.lista} space-y-6`}>
      <AntetPagina
        titlu={TITLURI.biblioteca}
        descriere={DESCRIERI.biblioteca}
        file={<NavCursuri activ="biblioteca" />}
        {...(poateCrea ? { actiuni: <FormularMaterialNou /> } : {})}
      />

      <BaraFiltre
        active={[
          ...(filtre.cauta === null ? [] : [{ cheie: "cauta", eticheta: `Caută: ${filtre.cauta}` }]),
          ...(filtre.fel === null ? [] : [{ cheie: "fel", eticheta: ETICHETE_FEL[filtre.fel] }]),
        ]}
        cheiProprii={["cauta", "fel"]}
      >
        <label className="flex flex-col gap-1">
          <span className="text-eticheta text-muted-foreground uppercase">Caută</span>
          <input
            type="search"
            name="cauta"
            defaultValue={filtre.cauta ?? ""}
            placeholder="Titlu sau cod"
            className={clasaControl()}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-eticheta text-muted-foreground uppercase">Fel</span>
          <select name="fel" defaultValue={filtre.fel ?? ""} className={clasaControl()}>
            <option value="">Toate</option>
            <option value="pdf">Documente</option>
            <option value="video">Filme</option>
          </select>
        </label>
      </BaraFiltre>

      <Tabel
        caption="Materialele refolosibile ale firmei."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(m) => m.id}
        href={(m) => `/cursuri/biblioteca/${m.id}`}
        gol={
          <StareGoala
            fel={filtre.cauta === null && filtre.fel === null ? "initiala" : "filtrata"}
            pictograma={Library}
            titlu={filtre.cauta === null ? "Biblioteca e goală" : "Niciun material găsit"}
            descriere={
              filtre.cauta === null
                ? "Adăugați un PDF sau un film. Un material încărcat o dată poate intra în oricâte cursuri."
                : "Schimbați căutarea sau ștergeți filtrele."
            }
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
