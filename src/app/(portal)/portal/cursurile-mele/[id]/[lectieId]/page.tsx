// src/app/(portal)/portal/cursurile-mele/[id]/[lectieId]/page.tsx
// Vizualizatorul. Butonul de încheiere stă în ACELAȘI ecran cu conținutul, în
// bara lipită de jos pe telefon — omul nu trebuie să navigheze ca să confirme
// ce tocmai a făcut.

import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { idDinRuta } from "@/lib/rute/parametri";
import {
  citesteCurs,
  citesteInrolare,
  citesteLectieInrolare,
  citesteMaterial,
  citesteVersiune,
  incercarileLectiei,
  intrebarileVersiunii,
} from "@/lib/queries/cursuri";
import { fisaMea } from "@/lib/queries/portal";
import { adresaIncorporare, adresaPublica } from "@/lib/media/link-extern";
import type { Lectie } from "@/domain/cursuri/scadente";

import { FaraFisa } from "../../../fara-fisa";
import { VizualizatorSimplu } from "./vizualizator-simplu";
import { VizualizatorVideo } from "./vizualizator-lectie";
import { TestGrila } from "./test-grila";

export const metadata: Metadata = { title: "Lecție" };

export default async function PaginaLectie({
  params,
}: {
  readonly params: Promise<{ readonly id: string; readonly lectieId: string }>;
}) {
  const brute = await params;
  const inrolareId = idDinRuta(brute.id);
  const lectieId = idDinRuta(brute.lectieId);

  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "courses"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  const scope = scopeFor(permisiuni, "courses:read");
  if (scope === null || scope === "none" || !can(permisiuni, "courses:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta cursurile." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const [inrolare, lectieRand] = await Promise.all([
    citesteInrolare(tenant.organizationId, inrolareId),
    citesteLectieInrolare(tenant.organizationId, lectieId),
  ]);
  if (inrolare === null || lectieRand === null) notFound();
  // Trei verificări, nu una: RLS apără rândul, dar ecranul spune „al meu" și
  // lecția trebuie să aparțină ACESTEI înrolări, nu doar acestei persoane.
  if (inrolare.employee_id !== stare.fisa.id) notFound();
  if (lectieRand.id !== lectieId || lectieRand.ordine < 1) notFound();

  const [curs, versiune, material] = await Promise.all([
    citesteCurs(tenant.organizationId, inrolare.course_id),
    lectieRand.version_id === null
      ? Promise.resolve(null)
      : citesteVersiune(tenant.organizationId, lectieRand.version_id),
    citesteMaterial(tenant.organizationId, lectieRand.material_id),
  ]);

  const lectie: Lectie = {
    titlu: lectieRand.titlu,
    status: lectieRand.status,
    treaptaDovada: lectieRand.treapta_dovada,
    procentMinim: lectieRand.procent_minim,
    durataSecunde: lectieRand.durata_secunde,
    secundeVizionate: lectieRand.secunde_vizionate,
    semnaturaNume: lectieRand.semnatura_nume,
  };

  const link =
    versiune !== null && versiune.link_id !== null && versiune.link_furnizor !== null
      ? {
          furnizor: versiune.link_furnizor,
          adresaIncorporare: adresaIncorporare({
            furnizor: versiune.link_furnizor,
            id: versiune.link_id,
            codPrivat: versiune.link_cod_privat,
          }),
          adresaPublica: adresaPublica({
            furnizor: versiune.link_furnizor,
            id: versiune.link_id,
            codPrivat: versiune.link_cod_privat,
          }),
        }
      : null;

  // Vizualizatorul cu măsurare doar acolo unde măsurarea are sens: film propriu,
  // cu treapta `parcurgere`. În rest, cel simplu.
  const cuMasurare =
    lectieRand.fel === "video" && link === null && lectieRand.treapta_dovada === "parcurgere";

  // Testul se citește doar când e cerut: `intrebarileVersiunii` face o
  // interogare, iar 95 % din lecții n-au test.
  const esteTest = lectieRand.treapta_dovada === "test" && lectieRand.version_id !== null;
  const [intrebari, incercari] = esteTest
    ? await Promise.all([
        intrebarileVersiunii(tenant.organizationId, lectieRand.version_id ?? ""),
        incercarileLectiei(tenant.organizationId, lectieId),
      ])
    : [[], []];

  return (
    <div className="space-y-4 p-4">
      <AntetPagina
        titlu={lectieRand.titlu}
        firimituri={[
          { eticheta: "Cursurile mele", href: "/portal/cursurile-mele" },
          { eticheta: curs?.denumire ?? "Curs", href: `/portal/cursurile-mele/${inrolareId}` },
          { eticheta: `Lecția ${String(lectieRand.ordine)}` },
        ]}
      />

      {esteTest ? (
        <>
          {/* Conținutul rămâne deasupra testului: omul trebuie să poată reciti
              materialul fără să iasă din ecran. */}
          <VizualizatorSimplu
            lectieId={lectieId}
            inrolareId={inrolareId}
            lectie={{ ...lectie, treaptaDovada: "bifa", status: "finalizat" }}
            versiuneId={lectieRand.version_id}
            link={link}
            transcriere={material?.transcriere ?? null}
            declaratieText={null}
          />
          <TestGrila
            lectieId={lectieId}
            inrolareId={inrolareId}
            titlu={lectieRand.titlu}
            intrebari={intrebari}
            pragTest={lectieRand.prag_test ?? 100}
            incercariAnterioare={incercari.length}
            dejaTrecut={lectieRand.status === "finalizat"}
          />
        </>
      ) : cuMasurare ? (
        <VizualizatorVideo
          lectieId={lectieId}
          inrolareId={inrolareId}
          lectie={lectie}
          versiuneId={lectieRand.version_id}
          areSubtitrare={(versiune?.subtitrare_path ?? null) !== null}
        />
      ) : lectieRand.fel === "video" && link === null ? (
        <VizualizatorVideo
          lectieId={lectieId}
          inrolareId={inrolareId}
          lectie={lectie}
          versiuneId={lectieRand.version_id}
          areSubtitrare={(versiune?.subtitrare_path ?? null) !== null}
        />
      ) : (
        <VizualizatorSimplu
          lectieId={lectieId}
          inrolareId={inrolareId}
          lectie={lectie}
          versiuneId={lectieRand.version_id}
          link={link}
          transcriere={material?.transcriere ?? null}
          declaratieText={lectieRand.declaratie_text}
        />
      )}
    </div>
  );
}
