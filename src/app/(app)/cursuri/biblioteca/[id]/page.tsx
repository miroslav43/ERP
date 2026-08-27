// src/app/(app)/cursuri/biblioteca/[id]/page.tsx
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Callout } from "@/components/ui/callout";
import { ListaDefinitii } from "@/components/ui/lista-definitii";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import { formatDateTime } from "@/lib/format/date";
import type { CheieRaspuns } from "@/lib/queries/cursuri";
import {
  cheiaVersiunii,
  citesteMaterial,
  intrebarileVersiunii,
  versiunileMaterialului,
} from "@/lib/queries/cursuri";
import { durataCitibila } from "@/domain/cursuri/scadente";
import { ETICHETE_FURNIZOR } from "@/lib/media/link-extern";
import { FileWarning } from "lucide-react";

import { ETICHETE_FEL, ETICHETE_SURSA, ETICHETE_TREAPTA, EXPLICATII_TREAPTA } from "../../etichete";
import { ConstructorTest } from "./constructor-test";
import { FormularLink } from "./formular-link";
import { IncarcareVersiune } from "./incarcare-versiune";

export const metadata: Metadata = { title: "Material" };

export default async function PaginaMaterial({
  params,
}: {
  readonly params: Promise<{ readonly id: string }>;
}) {
  const { id } = await params;
  const materialId = idDinRuta(id);

  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "courses");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta biblioteca de materiale." />;
  }

  const material = await citesteMaterial(tenant.organizationId, materialId);
  if (material === null) notFound();

  const poateIncarca = can(permisiuni, "courses:create", "team");
  const versiuni = await versiunileMaterialului(tenant.organizationId, materialId);

  /*
   * Testul aparține VERSIUNII curente, nu materialului: dovada de parcurgere
   * ancorează versiunea, deci întrebările la care a răspuns cineva anul trecut
   * rămân cele de atunci. O versiune nouă primește un test nou.
   */
  const versiuneCurenta = versiuni.find((v) => v.id === material.versiune_curenta_id) ?? null;
  const areTest = material.treapta_dovada === "test" && versiuneCurenta !== null;
  const [intrebariTest, cheieTest] = areTest
    ? await Promise.all([
        intrebarileVersiunii(tenant.organizationId, versiuneCurenta.id),
        cheiaVersiunii(tenant.organizationId, versiuneCurenta.id),
      ])
    : [[], {} as CheieRaspuns];

  const coloane: readonly Coloana<(typeof versiuni)[number]>[] = [
    {
      cheie: "versiune",
      antet: "Versiune",
      numeric: true,
      latime: "ingusta",
      peTelefon: "titlu",
      celula: (v) => (
        <span className="font-medium tabular-nums">
          v{v.versiune}
          {v.id === material.versiune_curenta_id ? (
            <Badge ton="succes" className="ml-2">
              Curentă
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      cheie: "continut",
      antet: "Conținut",
      peTelefon: "meta",
      celula: (v) =>
        v.link_id === null
          ? (v.fisier_nume ?? "—")
          : `${ETICHETE_FURNIZOR[v.link_furnizor ?? "youtube"]} · ${v.link_id}`,
    },
    {
      cheie: "durata",
      antet: "Durată",
      peTelefon: "meta",
      celula: (v) => (v.durata_secunde === null ? "—" : durataCitibila(v.durata_secunde)),
    },
    {
      cheie: "publicata",
      antet: "Publicată",
      peTelefon: "meta",
      celula: (v) => (v.publicata_la === null ? "—" : formatDateTime(v.publicata_la)),
    },
    {
      cheie: "nota",
      antet: "Notă",
      peTelefon: "ascuns",
      celula: (v) => v.nota_versiune ?? "—",
    },
  ];

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <AntetPagina
        titlu={material.titlu}
        descriere={material.descriere ?? "Fără descriere."}
        firimituri={[
          { eticheta: "Cursuri", href: "/cursuri" },
          { eticheta: "Bibliotecă", href: "/cursuri/biblioteca" },
          { eticheta: material.titlu },
        ]}
      />

      <ListaDefinitii
        coloane={4}
        textNecompletat="—"
        definitii={[
          { eticheta: "Cod", valoare: material.cod, identificator: true },
          { eticheta: "Fel", valoare: ETICHETE_FEL[material.fel] },
          { eticheta: "Sursă", valoare: ETICHETE_SURSA[material.sursa] },
          {
            eticheta: "Dovadă",
            valoare: `${ETICHETE_TREAPTA[material.treapta_dovada]}${
              material.procent_minim === null ? "" : ` (${String(material.procent_minim)} %)`
            }`,
          },
        ]}
      />

      <Callout fel="informativ" titlu={ETICHETE_TREAPTA[material.treapta_dovada]}>
        {EXPLICATII_TREAPTA[material.treapta_dovada]}
      </Callout>

      {material.versiune_curenta_id === null ? (
        <Callout fel="atentie" titlu="Materialul nu are încă niciun conținut">
          Până nu încărcați un fișier sau nu lipiți un link, angajații nu au ce deschide, iar
          cursurile care îl conțin nu se pot parcurge.
        </Callout>
      ) : null}

      {poateIncarca ? (
        <section aria-labelledby="titlu-versiune-noua" className="space-y-3">
          <h2 id="titlu-versiune-noua" className="text-sectiune font-medium">
            Versiune nouă
          </h2>
          <p className="text-muted-foreground text-corp">
            O versiune publicată nu-și mai schimbă conținutul: dovada de parcurgere o ancorează. Un
            material actualizat primește o versiune nouă, iar cine a început deja continuă pe cea
            veche.
          </p>
          {material.sursa === "link" ? (
            <FormularLink materialId={materialId} />
          ) : (
            <IncarcareVersiune
              materialId={materialId}
              fel={material.fel}
              cereDurata={material.treapta_dovada === "parcurgere"}
            />
          )}
        </section>
      ) : null}

      {areTest && poateIncarca && versiuneCurenta !== null ? (
        <section aria-labelledby="titlu-test" className="space-y-3">
          <h2 id="titlu-test" className="text-sectiune font-medium">
            Testul versiunii v{versiuneCurenta.versiune}
          </h2>
          <ConstructorTest
            versiuneId={versiuneCurenta.id}
            pragTest={material.prag_test ?? 100}
            initiale={intrebariTest.map((i) => ({
              id: i.id,
              text: i.text,
              optiuni: i.optiuni,
              corect: cheieTest[i.id] ?? "",
            }))}
          />
        </section>
      ) : null}

      <section aria-labelledby="titlu-versiuni" className="space-y-3">
        <h2 id="titlu-versiuni" className="text-sectiune font-medium">
          Versiuni
        </h2>
        <Tabel
          caption="Versiunile materialului, cea mai nouă prima."
          coloane={coloane}
          randuri={versiuni}
          cheieRand={(v) => v.id}
          gol={
            <StareGoala
              fel="initiala"
              compact
              pictograma={FileWarning}
              titlu="Nicio versiune"
              descriere="Încărcați primul fișier sau lipiți primul link."
            />
          }
        />
      </section>
    </div>
  );
}
