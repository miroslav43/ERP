// src/app/(portal)/portal/pontajul-meu/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { Clock, CalendarClock } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { EmptyState } from "@/components/feedback/empty-state";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate, formatMonthYear, todayInBucharest } from "@/lib/format/date";
import { anDinUrl } from "@/lib/rute/parametri";
import { pontajulMeu, fisaMea } from "@/lib/queries/portal";

import { ETICHETE_TIP_ZI } from "../etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Pontajul meu" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Luna din URL, cu revenire la luna curentă. Ca `anDinUrl`, dar pentru 1–12. */
function lunaDinUrl(valoare: string | string[] | undefined, implicit: number): number {
  const brut = Array.isArray(valoare) ? valoare[0] : valoare;
  if (brut === undefined) return implicit;
  const parsat = Number(brut);
  if (!Number.isInteger(parsat) || parsat < 1 || parsat > 12) return implicit;
  return parsat;
}

export default async function PaginaPontajulMeu({ searchParams }: ProprietatiPagina) {
  const { tenant, user } = await requireTenant();
  await requireFeature(tenant.organizationId, "attendance");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);

  if (!can(permisiuni, "attendance:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta pontajul. Cereți-i administratorului organizației dreptul necesar." />
      </div>
    );
  }

  // `fisaMea`, nu `idFisaProprie`: cea din urmă doar SORTEAZĂ după `is_primary`,
  // în timp ce `app.current_employee_id()` — prin care trec toate ramurile `own`
  // din RLS — chiar îl cere. Un cont a cărui unică fișă nu e principală primea
  // altfel un ecran care îi arăta numele și nicio dată, fără nicio explicație.
  // `attendance:create`, nu `:read`: planul e o scriere. Fără dreptul ăsta,
  // butonul ar duce direct într-un refuz.
  const poatePlanifica = can(permisiuni, "attendance:create", "own");

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;
  const propriaFisaId = stare.fisa.id;

  const parametri = await searchParams;
  const azi = todayInBucharest();
  const an = anDinUrl(parametri["an"], Number(azi.slice(0, 4)));
  const luna = lunaDinUrl(parametri["luna"], Number(azi.slice(5, 7)));

  const zile = await pontajulMeu(tenant.organizationId, an, luna, propriaFisaId);

  const total = zile.reduce(
    (s, z) => ({
      lucrate: s.lucrate + (z.ore_lucrate ?? 0),
      suplimentare: s.suplimentare + (z.ore_suplimentare ?? 0),
      noapte: s.noapte + (z.ore_noapte ?? 0),
    }),
    { lucrate: 0, suplimentare: 0, noapte: 0 },
  );

  // Navigarea între luni se face pe șiruri de dată, nu pe `Date`: ziua 1 a lunii
  // convertită în `Date` alunecă peste graniță în funcție de fus.
  const lunaAnterioara = luna === 1 ? { an: an - 1, luna: 12 } : { an, luna: luna - 1 };
  const lunaUrmatoare = luna === 12 ? { an: an + 1, luna: 1 } : { an, luna: luna + 1 };

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-foreground text-xl font-semibold">Pontajul meu</h1>
        {poatePlanifica ? (
          <Link
            href="/portal/pontajul-meu/saptamana"
            className="border-border hover:border-primary text-foreground inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors"
          >
            <CalendarClock aria-hidden="true" className="size-4" />
            Planul săptămânii
          </Link>
        ) : null}
      </header>

      <nav aria-label="Alege luna" className="flex items-center justify-between gap-2">
        <Link
          href={`/portal/pontajul-meu?an=${lunaAnterioara.an}&luna=${lunaAnterioara.luna}`}
          className="border-border text-foreground hover:border-ring min-h-11 rounded-md border px-4 py-2 text-sm"
        >
          ← Luna anterioară
        </Link>
        <p className="text-foreground text-sm font-medium">{formatMonthYear(an, luna)}</p>
        <Link
          href={`/portal/pontajul-meu?an=${lunaUrmatoare.an}&luna=${lunaUrmatoare.luna}`}
          className="border-border text-foreground hover:border-ring min-h-11 rounded-md border px-4 py-2 text-sm"
        >
          Luna următoare →
        </Link>
      </nav>

      {zile.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nicio zi înregistrată în această lună"
          description="Zilele apar aici pe măsură ce sunt completate. Dacă luna s-a încheiat și tot e goală, întrebați responsabilul de pontaj."
        />
      ) : (
        <>
          <section
            aria-label="Totaluri"
            className="bg-primary text-primary-foreground grid grid-cols-3 gap-2 rounded-lg p-4 text-center"
          >
            <Total eticheta="Ore lucrate" valoare={total.lucrate} />
            <Total eticheta="Suplimentare" valoare={total.suplimentare} />
            <Total eticheta="De noapte" valoare={total.noapte} />
          </section>

          <ul className="space-y-2">
            {zile.map((z) => (
              <li key={z.id}>
                {/* Rândul e link doar când ziua chiar se poate edita: o zi venită
                    din concediu sau dintr-o lună închisă ar duce la un ecran care
                    explică refuzul, ceea ce e corect — dar un rând care nu
                    reacționează spune mai bine „nu e nimic de făcut aici". */}
                <ZiRand data={z.data} editabila={poatePlanifica && z.tip_zi === "lucratoare"}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-foreground text-sm font-medium">{formatDate(z.data)}</p>
                      <p className="text-muted-foreground text-xs">
                        {ETICHETE_TIP_ZI[z.tip_zi] ?? z.tip_zi}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground text-sm tabular-nums">
                        {(z.ore_lucrate ?? 0).toLocaleString("ro-RO")} ore
                      </p>
                      {(z.ore_suplimentare ?? 0) > 0 ? (
                        <p className="text-muted-foreground text-xs tabular-nums">
                          +{(z.ore_suplimentare ?? 0).toLocaleString("ro-RO")} suplimentare
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {z.observatii === null ? null : (
                    <p className="text-muted-foreground mt-2 text-xs">{z.observatii}</p>
                  )}
                </ZiRand>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Total({ eticheta, valoare }: { readonly eticheta: string; readonly valoare: number }) {
  return (
    <div>
      <p className="text-xs opacity-90">{eticheta}</p>
      <p className="text-2xl font-semibold tabular-nums">{valoare.toLocaleString("ro-RO")}</p>
    </div>
  );
}

/**
 * Rândul unei zile: link când e editabilă, simplu card când nu.
 *
 * Un singur element interactiv per rând, niciodată un link într-un link — de
 * aceea decizia se ia aici, nu prin înfășurarea condiționată a conținutului.
 */
function ZiRand({
  data,
  editabila,
  children,
}: {
  readonly data: string;
  readonly editabila: boolean;
  readonly children: React.ReactNode;
}) {
  const clasa = "bg-surface border-border block rounded-lg border p-3";
  if (!editabila) return <div className={clasa}>{children}</div>;
  return (
    <Link
      href={`/portal/pontajul-meu/zi/${data}`}
      className={`${clasa} hover:border-ring transition-colors`}
    >
      {children}
    </Link>
  );
}
