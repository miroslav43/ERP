// src/app/(app)/ticketing/coada/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { LifeBuoy } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { limitaDinUrl, listeazaTichete, rezumatCoada } from "@/lib/queries/ticketing";
import { filtreTicheteSchema } from "@/schemas/ticketing";
import { filtreDinUrl } from "@/lib/rute/parametri";

import { adresaCu } from "../adresa";
import { TabelTichete } from "../tabel-tichete";

export const metadata: Metadata = { title: "Coada de tichete" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * O cifră de pe tabloul cozii.
 *
 * ── DE CE UNELE SUNT LINKURI ȘI ALTELE NU ────────────────────────────────────
 * Auditul cerea, pe drept, ca toate patru să fie apăsabile: o cifră pe care o
 * vezi și nu o poți deschide e afișaj, nu instrument. Dar numai două dintre ele
 * au un filtru ECHIVALENT în `filtreTicheteSchema`, care primește UN status.
 * „Deschise" înseamnă cinci statusuri deodată, iar „fără mișcare" e un prag de
 * timp — un link către cea mai apropiată listă ar duce la altceva decât spune
 * cifra, ceea ce e mai rău decât un număr care stă pe loc. Cele două care se pot
 * deschide se deschid; celelalte două rămân cifre, până când filtrele cozii
 * primesc statusuri multiple.
 */
function Cifra({
  eticheta,
  valoare,
  href,
}: Readonly<{ eticheta: string; valoare: number; href?: string }>) {
  const continut = (
    <>
      <p className="text-muted-foreground text-nota">{eticheta}</p>
      <p className="text-foreground text-titlu mt-1 font-semibold tabular-nums">{valoare}</p>
    </>
  );

  if (href === undefined) {
    return <div className="border-border bg-surface rounded-panou border p-4">{continut}</div>;
  }

  return (
    <Link
      href={href}
      className="border-border bg-surface hover:border-primary hover:bg-background rounded-panou block border p-4 transition-colors"
    >
      {continut}
    </Link>
  );
}

async function Continut({
  organizationId,
  parametri,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
}) {
  const filtre = filtreDinUrl(filtreTicheteSchema, parametri);
  const cursor = typeof parametri["cursor"] === "string" ? parametri["cursor"] : null;
  const limita = limitaDinUrl(parametri["limita"]);

  // Paginarea era calculată în stratul de citiri și aruncată chiar aici, la
  // destructurare — `const [rezumat, { randuri }] = …`. Cifrele numărau toată
  // coada, tabelul arăta primele douăzeci și cinci de rânduri, iar între cele
  // două nu exista niciun drum. Acum cifra din paginare și cifrele de sus vin
  // din aceleași filtre, iar restul rândurilor au unde să fie deschise.
  const [rezumat, { randuri, urmatorulCursor, total }] = await Promise.all([
    rezumatCoada(organizationId),
    listeazaTichete(organizationId, filtre, cursor, null, limita),
  ]);

  const catreStatus = (status: string): string =>
    adresaCu("/ticketing/coada", parametri, (p) => {
      p.set("status", status);
      // Cursorul nu supraviețuiește unei schimbări de filtru: ar continua de la
      // un rând care, în lista nouă, nu mai e acolo unde era.
      p.delete("cursor");
    });

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra eticheta="Deschise" valoare={rezumat.deschise} />
        {/* „De aprobat" spunea că cifra e a privitorului. Nu era: numără toate
            cererile aflate în aprobare, indiferent cine e managerul direct al
            solicitantului, iar dreptul de a decide îl verifică
            `internal.tickets_valideaza_tranzitia` la scriere. Eticheta spune
            acum ce numără cifra. */}
        <Cifra
          eticheta="În aprobare"
          valoare={rezumat.deAprobat}
          href={catreStatus("in_aprobare")}
        />
        <Cifra
          eticheta="Așteaptă solicitantul"
          valoare={rezumat.asteaptaSolicitantul}
          href={catreStatus("in_asteptare")}
        />
        <Cifra eticheta="Fără mișcare de 7 zile" valoare={rezumat.faraMiscareDe7Zile} />
      </div>

      {randuri.length === 0 ? (
        <StareGoala
          fel={filtre.status === undefined && filtre.cauta === undefined ? "initiala" : "filtrata"}
          pictograma={LifeBuoy}
          titlu="Nimic în coadă"
          descriere="Tichetele echipei apar aici pe măsură ce sunt deschise."
          {...(filtre.status === undefined
            ? {}
            : { actiune: { eticheta: "Vezi toată coada", href: "/ticketing/coada" } })}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <TabelTichete randuri={randuri} aratSolicitantul aratAsignatul />
          <Paginare
            afisate={randuri.length}
            total={total}
            cursorUrmator={urmatorulCursor}
            limita={limita}
            construiesteHref={({ cursor: nou, limita: marime }) =>
              adresaCu("/ticketing/coada", parametri, (p) => {
                p.set("limita", String(marime));
                if (nou === null) p.delete("cursor");
                else p.set("cursor", nou);
              })
            }
          />
        </div>
      )}
    </>
  );
}

export default async function PaginaCoada({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "ticketing");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  // `team`: coada e pentru cine are oameni în subordine sau răspunde de modul.
  // Un angajat obișnuit are doar `own` și rămâne pe „Tichetele mele”.
  if (!can(permisiuni, "tickets:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Coada de tichete e vizibilă managerilor și administratorilor. Tichetele proprii le găsiți în „Tichetele mele”." />
    );
  }

  const parametri = await searchParams;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Coada de tichete"
        descriere="Tichetele la care ai acces, cu cererile care așteaptă decizia ta."
      />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={7} />}>
        <Continut organizationId={tenant.organizationId} parametri={parametri} />
      </Suspense>
    </div>
  );
}
