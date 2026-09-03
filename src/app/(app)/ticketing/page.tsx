// src/app/(app)/ticketing/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import type { PermissionScope } from "@/config/permissions";
import { requireUser } from "@/lib/auth/current-user";
import { idFisaProprie } from "@/lib/queries/employees";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { limitaDinUrl, listeazaTichete } from "@/lib/queries/ticketing";
import { filtreTicheteSchema } from "@/schemas/ticketing";
import { filtreDinUrl } from "@/lib/rute/parametri";

import { adresaCu } from "./adresa";
import { TabelTichete } from "./tabel-tichete";

export const metadata: Metadata = { title: "Tichetele mele" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function ListaMea({
  organizationId,
  userId,
  scope,
  parametri,
}: {
  readonly organizationId: string;
  readonly userId: string;
  readonly scope: PermissionScope | null;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreTicheteSchema, parametri);

  /*
   * ECRANUL SE NUMEȘTE „TICHETELE MELE" ȘI TREBUIE SĂ ARATE ALE MELE.
   *
   * Înainte, aici se chema `listeazaTichete` fără niciun filtru de solicitant,
   * cu justificarea că „RLS-ul arată deja fiecăruia ce are voie să vadă". E
   * adevărat, dar e răspunsul la altă întrebare: RLS decide ce AI VOIE să vezi,
   * nu ce ai TRIMIS. Pentru un `org_admin`, cele două nu coincid deloc — el
   * vedea coada întregii firme sub un titlu care spune „Cererile și problemele
   * pe care le-ai trimis către IT". Coada echipei are ecranul ei,
   * `/ticketing/coada`, cu `minScope: "team"`; cele două arătau același lucru.
   *
   * Avertismentul era scris în chiar stratul de citiri, la `ticheteleMele`
   * (`queries/ticketing.ts:106`), și n-a fost citit.
   *
   * Tiparul de mai jos e cel din `inventar/in-primire`: la scop `own`, RLS
   * restrânge deja singură, deci nu se mai caută fișa; la `team`/`all` trebuie
   * aflată explicit, altfel filtrul n-ar avea ce aplica.
   */
  let propriaFisaId: string | null = null;
  let faraFisa = false;
  if (scope !== "own") {
    propriaFisaId = await idFisaProprie(organizationId, userId);
    faraFisa = propriaFisaId === null;
  }

  const cursor = typeof parametri["cursor"] === "string" ? parametri["cursor"] : null;
  const limita = limitaDinUrl(parametri["limita"]);
  // Paginarea era CALCULATĂ de stratul de citiri și aruncată aici, la
  // destructurare: `listeazaTichete` întorcea „mai sunt rânduri", nimeni nu
  // primea cursorul, iar al douăzeci și șaselea tichet al unui om nu se putea
  // deschide din nicio listă.
  const { randuri, urmatorulCursor, total } = faraFisa
    ? { randuri: [], urmatorulCursor: null, total: 0 }
    : await listeazaTichete(organizationId, filtre, cursor, propriaFisaId, limita);

  if (faraFisa) {
    // Un `org_admin` care nu e și angajat n-are fișă de personal, deci n-are cum
    // să fie solicitantul unui tichet — nici să deschidă unul. „Deschide un
    // tichet" ar fi fost un sfat care nu funcționează.
    return (
      <StareGoala
        fel="restrictionata"
        pictograma={LifeBuoy}
        titlu="Contul nu are fișă de personal"
        descriere="Tichetele se leagă de fișa de angajat a solicitantului, iar contul dumneavoastră nu are una. Coada echipei rămâne accesibilă din meniu."
      />
    );
  }

  if (randuri.length === 0) {
    return (
      <StareGoala
        fel="initiala"
        pictograma={LifeBuoy}
        titlu="Niciun tichet deschis"
        descriere="Când ai nevoie de software, de un echipament, ți s-a stricat ceva sau ai găsit o problemă în aplicație, deschide un tichet."
        actiune={{ eticheta: "Deschide un tichet", href: "/ticketing/nou" }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <TabelTichete randuri={randuri} />
      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={limita}
        construiesteHref={({ cursor: nou, limita: marime }) =>
          adresaCu("/ticketing", parametri, (p) => {
            p.set("limita", String(marime));
            if (nou === null) p.delete("cursor");
            else p.set("cursor", nou);
          })
        }
      />
    </div>
  );
}

export default async function PaginaTichetelorMele({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "ticketing"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  const utilizator = await requireUser();
  const scope = scopeFor(permisiuni, "tickets:read");

  if (!can(permisiuni, "tickets:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta tichetele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const parametri = await searchParams;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Tichetele mele"
        descriere="Cererile și problemele pe care le-ai trimis către IT, cu starea fiecăreia."
        actiuni={
          <Link href="/ticketing/nou" className={buton({ varianta: "primar" })}>
            Tichet nou
          </Link>
        }
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={6} />}>
        <ListaMea
          organizationId={tenant.organizationId}
          userId={utilizator.id}
          scope={scope}
          parametri={parametri}
        />
      </Suspense>
    </div>
  );
}
