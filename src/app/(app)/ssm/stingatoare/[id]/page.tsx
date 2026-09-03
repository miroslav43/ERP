// src/app/(app)/ssm/stingatoare/[id]/page.tsx
import { treaptaSsm } from "@/domain/ssm/scadente";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { Badge } from "@/components/ui/badge";
import { Scadenta } from "@/components/ui/scadenta";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireUser } from "@/lib/auth/current-user";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { idDinRuta } from "@/lib/rute/parametri";
import { citesteStingator, verificariStingator } from "@/lib/queries/ssm";
import { stareScadentaSsm } from "@/domain/ssm/scadente";

import {
  ETICHETE_REZULTAT_VERIFICARE,
  ETICHETE_SCADENTA,
  ETICHETE_STATUS_STINGATOR,
  ETICHETE_TIP_VERIFICARE_STINGATOR,
  TONURI_STATUS_STINGATOR,
} from "../../etichete";
import { FormularVerificare } from "./formular-verificare";

export const metadata: Metadata = { title: "Fișa stingătorului" };

interface ProprietatiPagina {
  readonly params: Promise<{ readonly id: string }>;
}

export default async function PaginaStingator({ params }: ProprietatiPagina) {
  const id = idDinRuta((await params).id);

  await requireUser();
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "ssm"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "ssm:read", "team")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta stingătoarele. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const stingator = await citesteStingator(tenant.organizationId, id);
  if (stingator === null) notFound();

  const verificari = await verificariStingator(stingator.id);
  const azi = todayInBucharest();
  const poateInregistra = can(permisiuni, "ssm:create", "team");

  const obligatii = [
    {
      cheie: "verificare" as const,
      titlu: "Verificare tehnică",
      data: stingator.ultima_verificare,
      scadenta: stingator.scadenta_verificare,
    },
    {
      cheie: "reincarcare" as const,
      titlu: "Reîncărcare",
      data: stingator.ultima_reincarcare,
      scadenta: stingator.scadenta_reincarcare,
    },
    {
      cheie: "proba_presiune" as const,
      titlu: "Probă de presiune",
      data: stingator.ultima_proba_presiune,
      scadenta: stingator.scadenta_proba_presiune,
    },
  ];

  /**
   * Istoricul se citește întreg (`verificariStingator` n-are cursor), deci
   * tabelul n-are nici sortare, nici paginare — doar căderea pe card sub 768px.
   */
  const coloaneVerificari: readonly Coloana<(typeof verificari)[number]>[] = [
    {
      cheie: "data",
      antet: "Data",
      peTelefon: "titlu",
      latime: "ingusta",
      celula: (v) => formatDate(v.data),
    },
    {
      cheie: "tip",
      antet: "Tip",
      peTelefon: "meta",
      celula: (v) => ETICHETE_TIP_VERIFICARE_STINGATOR[v.tip_verificare],
    },
    {
      cheie: "firma",
      antet: "Firmă autorizată",
      peTelefon: "meta",
      celula: (v) => v.firma_autorizata ?? v.executant ?? "—",
    },
    {
      cheie: "rezultat",
      antet: "Rezultat",
      peTelefon: "meta",
      celula: (v) => ETICHETE_REZULTAT_VERIFICARE[v.rezultat],
    },
    {
      cheie: "cost",
      antet: "Cost",
      numeric: true,
      peTelefon: "meta",
      latime: "ingusta",
      celula: (v) => (v.cost === null ? "—" : formatLei(v.cost)),
    },
  ];

  // `descriere` e șir, nu JSX: componenta o cere așa. Textul rămâne identic.
  const unde = `${stingator.tip} · ${stingator.locatie}${
    stingator.cladire === null ? "" : ` · ${stingator.cladire}`
  }`;

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <p className="text-muted-foreground text-corp">
        <Link href="/ssm/stingatoare" className="underline-offset-2 hover:underline">
          Stingătoare
        </Link>
      </p>

      <AntetPagina
        titlu={stingator.cod}
        descriere={unde}
        actiuni={
          <>
            {can(permisiuni, "ssm:update", "team") ? (
              <Link
                href={`/ssm/stingatoare/${stingator.id}/editeaza`}
                className={buton({ varianta: "secundar" })}
              >
                Editează
              </Link>
            ) : null}
            <Badge ton={TONURI_STATUS_STINGATOR[stingator.status]}>
              {ETICHETE_STATUS_STINGATOR[stingator.status]}
            </Badge>
          </>
        }
      />

      <section
        aria-label="Cele trei obligații de întreținere"
        className="border-border rounded-panou grid gap-4 border p-4 sm:grid-cols-3"
      >
        {obligatii.map((o) => {
          const stare = stareScadentaSsm(o.data !== null, o.scadenta, azi);
          return (
            <div key={o.cheie}>
              <dt className="text-muted-foreground text-nota">{o.titlu}</dt>
              <dd className="mt-1 space-y-1">
                <Scadenta treapta={treaptaSsm(stare, o.scadenta)}>
                  {ETICHETE_SCADENTA[stare]}
                </Scadenta>
                <p className="text-corp">
                  {o.data === null ? "niciodată" : `ultima: ${formatDate(o.data)}`}
                </p>
                {o.scadenta === null ? null : (
                  <p className="text-muted-foreground text-nota">
                    scadență: {formatDate(o.scadenta)}
                  </p>
                )}
              </dd>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="istoric-verificari" className="space-y-3">
        <h2 id="istoric-verificari" className="text-sectiune font-semibold">
          Istoric verificări
        </h2>
        {verificari.length === 0 ? (
          <p className="text-muted-foreground text-corp">Nicio verificare înregistrată.</p>
        ) : (
          <Tabel
            caption={`Istoricul verificărilor stingătorului ${stingator.cod}.`}
            coloane={coloaneVerificari}
            randuri={verificari}
            cheieRand={(v) => v.id}
            gol={null}
          />
        )}
      </section>

      {poateInregistra ? <FormularVerificare extinguisherId={stingator.id} /> : null}
    </div>
  );
}
