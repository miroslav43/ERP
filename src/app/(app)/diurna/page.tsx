// src/app/(app)/diurna/page.tsx
import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Plane, PlaneTakeoff } from "lucide-react";

import type { BaremTara } from "@/domain/per-diem/sume";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { StareGoala } from "@/components/ui/stare-goala";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime, todayInBucharest } from "@/lib/format/date";
import { formatLei } from "@/lib/format/money";
import { scrieSortare } from "@/lib/queries/cursor";
import { filtreDinUrl } from "@/lib/rute/parametri";
import {
  angajatiDupaId,
  baremeleTarilor,
  calculeazaDiurnaDeplasare,
  calculeSalvate,
  listeazaDeplasari,
  politicaLaData,
  type CalculSalvat,
  type PoliticaRand,
  type RandDeplasare,
} from "@/lib/queries/per-diem";
import { filtreDeplasariSchema } from "@/schemas/per-diem";

import { ETICHETE_STATUS_DEPLASARE, TONURI_STATUS_DEPLASARE, textZile } from "./etichete";
import { FiltreDeplasari } from "./filtre-deplasari";
import { NavDiurna } from "./nav-diurna";

export const metadata: Metadata = { title: "Deplasări" };

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Rezumatul de sumă afișat pe un rând din listă.
 *
 * Preferă rândul din `per_diem_calculations` dacă există (îl scrie doar
 * `app.recalculeaza_diurna`, neapelabilă din client — practic mereu gol).
 * Altfel calculează în TS, cu ZERO etape reale: lista arată o estimare pe
 * ȚARA PROPRIE a deplasării, nu traseul exact — legile reale se văd pe fișa
 * deplasării, unde costul unei interogări suplimentare per rând se justifică.
 * Marcajul „(estimare)” face explicită diferența.
 */
function sumarDeplasare(
  rand: RandDeplasare,
  politiciDupaData: ReadonlyMap<string, PoliticaRand | null>,
  baremuri: readonly BaremTara[],
  salvat: CalculSalvat | undefined,
) {
  if (salvat !== undefined) {
    return {
      text: `${textZile(salvat.zile_total)}${salvat.valoare_lei === null ? "" : ` · ${formatLei(salvat.valoare_lei)}`}`,
      estimare: false,
    };
  }

  const politica = politiciDupaData.get(rand.plecare_la.slice(0, 10)) ?? null;
  if (politica === null) return { text: "fără politică valabilă", estimare: false };

  const { rezultat } = calculeazaDiurnaDeplasare(
    {
      countryId: rand.country_id,
      plecareLa: rand.plecare_la,
      sosireLa: rand.sosire_la,
      plecareEfectivaLa: rand.plecare_efectiva_la,
      sosireEfectivaLa: rand.sosire_efectiva_la,
      cursDiurna: rand.curs_diurna,
    },
    [],
    politica,
    baremuri,
  );

  return {
    text: `${textZile(rezultat.zileTotal)}${rezultat.valoareLei === null ? "" : ` · ${formatLei(rezultat.valoareLei)}`}`,
    estimare: true,
  };
}

async function TabelDeplasari({
  organizationId,
  parametri,
  arataAngajat,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly arataAngajat: boolean;
}) {
  const filtre = filtreDinUrl(filtreDeplasariSchema, parametri);
  const { randuri, urmatorulCursor, total, sortare } = await listeazaDeplasari(
    organizationId,
    filtre,
  );

  /**
   * Adresele se construiesc din parametrii EXISTENȚI, nu dintr-un obiect gol:
   * altfel o sortare ar șterge filtrul de stare, iar o schimbare de mărime a
   * paginii ar șterge sortarea.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/diurna" : `/diurna?${p.toString()}`;
  }

  if (randuri.length === 0) {
    const areFiltre = filtre.status !== null;
    // „Șterge filtrele” scoate DOAR cheile de filtrare, aceleași pe care le
    // administrează `<FiltreDeplasari>`. Un `href="/diurna"` sec ar fi luat cu
    // el și sortarea, și mărimea paginii — exact defectul reparat în bară.
    const faraFiltre = adresa((p) => {
      p.delete("status");
      p.delete("cursor");
    });
    return (
      <StareGoala
        fel={areFiltre ? "filtrata" : "initiala"}
        pictograma={Plane}
        titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio deplasare înregistrată"}
        descriere={
          areFiltre
            ? "Ștergeți filtrele ca să vedeți toate deplasările."
            : "Adăugați prima deplasare în interes de serviciu ca să urmăriți diurna și decontul."
        }
        {...(areFiltre ? { actiune: { eticheta: "Șterge filtrele", href: faraFiltre } } : {})}
      />
    );
  }

  const idDeplasari = randuri.map((r) => r.id);
  const idTari = [
    ...new Set(randuri.map((r) => r.country_id).filter((id): id is string => id !== null)),
  ];
  const dateDistincte = [...new Set(randuri.map((r) => r.plecare_la.slice(0, 10)))];

  const [salvate, baremuri, politiciListe, angajati] = await Promise.all([
    calculeSalvate(idDeplasari),
    baremeleTarilor(idTari),
    Promise.all(
      dateDistincte.map(
        async (data) => [data, await politicaLaData(organizationId, data)] as const,
      ),
    ),
    arataAngajat
      ? angajatiDupaId(
          organizationId,
          randuri.map((r) => r.employee_id),
        )
      : Promise.resolve(new Map<string, never>()),
  ]);
  const politiciDupaData = new Map(politiciListe);

  const coloanaAngajat: readonly Coloana<(typeof randuri)[number]>[] = arataAngajat
    ? [
        {
          cheie: "angajat",
          antet: "Angajat",
          peTelefon: "meta",
          celula: (r) => {
            const angajat = angajati.get(r.employee_id);
            return angajat === undefined ? "—" : `${angajat.full_name ?? "—"} (${angajat.marca})`;
          },
        },
      ]
    : [];

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "scop",
      antet: "Scop",
      sortabil: true,
      peTelefon: "titlu",
      celula: (r) => (
        <>
          <span className="font-medium">{r.scop}</span>
          {r.localitate === null ? null : (
            <span className="text-muted-foreground"> · {r.localitate}</span>
          )}
        </>
      ),
    },
    ...coloanaAngajat,
    {
      cheie: "plecare",
      antet: "Perioada",
      sortabil: true,
      peTelefon: "meta",
      celula: (r) => (
        <>
          {formatDateTime(new Date(r.plecare_la))} – {formatDateTime(new Date(r.sosire_la))}
        </>
      ),
    },
    {
      cheie: "stare",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (r) => (
        <Badge ton={TONURI_STATUS_DEPLASARE[r.status]}>{ETICHETE_STATUS_DEPLASARE[r.status]}</Badge>
      ),
    },
    {
      cheie: "diurna",
      antet: "Diurnă",
      peTelefon: "meta",
      celula: (r) => {
        const sumar = sumarDeplasare(r, politiciDupaData, baremuri, salvate.get(r.id));
        return (
          <>
            {sumar.text}
            {sumar.estimare ? (
              <span className="text-muted-foreground text-nota ml-1">(estimare)</span>
            ) : null}
          </>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Tabel
        caption="Deplasările în interes de serviciu, cu diurna estimată."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(r) => r.id}
        href={(r) => `/diurna/${r.id}`}
        sortare={sortare}
        hrefSortare={(s) =>
          adresa((p) => {
            p.set("sort", scrieSortare(s));
            // Cursorul nu supraviețuiește unei schimbări de sortare: ar continua
            // de la un rând care, în noua ordine, nu mai e acolo unde era.
            p.delete("cursor");
          })
        }
        gol={null}
      />
      <Paginare
        afisate={randuri.length}
        total={total}
        cursorUrmator={urmatorulCursor}
        limita={filtre.limita}
        construiesteHref={({ cursor, limita }) =>
          adresa((p) => {
            p.set("limita", String(limita));
            if (cursor === null) p.delete("cursor");
            else p.set("cursor", cursor);
          })
        }
      />
    </div>
  );
}

export default async function PaginaDiurna({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "per_diem:read", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta deplasările. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const scope = scopeFor(permisiuni, "per_diem:read");
  const poateAproba = can(permisiuni, "per_diem:approve", "team");
  const poateAdauga = can(permisiuni, "per_diem:create", "own");
  const poateConfiguraPolitica = can(permisiuni, "per_diem:update", "all");

  const azi = todayInBucharest();
  const politicaCurenta = await politicaLaData(tenant.organizationId, azi);
  const parametri = await searchParams;

  /**
   * Lipsa unei politici valabile AZI e un avertisment, nu o poartă.
   *
   * Ecranul returna aici un `StareGoala` și NU mai randa deloc tabelul: o firmă
   * a cărei politică s-a încheiat ieri își pierdea accesul la tot istoricul de
   * deplasări deja înregistrate — o problemă de configurare ascundea datele.
   * Politica lipsește doar pentru deplasările NOI (triggerul de inserare o cere
   * la data plecării), deci exact butonul de adăugare e cel care se închide.
   */
  const faraPolitica = politicaCurenta === null;

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Deplasări"
        descriere={
          scope === "own"
            ? "Deplasările dumneavoastră în interes de serviciu, cu diurna estimată."
            : "Deplasările la care aveți acces, cu diurna estimată."
        }
        {...(poateAdauga && !faraPolitica
          ? {
              actiuni: (
                <Link href="/diurna/noua" className={buton({ varianta: "primar" })}>
                  <PlaneTakeoff aria-hidden="true" className="size-4" />
                  Deplasare nouă
                </Link>
              ),
            }
          : {})}
        file={<NavDiurna poateAproba={poateAproba} />}
      />

      {faraPolitica ? (
        <Callout
          fel="atentie"
          titlu="Politica de diurnă nu e valabilă astăzi"
          {...(poateConfiguraPolitica
            ? {
                actiune: (
                  <Link href="/diurna/politica" className={buton({ varianta: "secundar" })}>
                    Configurează politica
                  </Link>
                ),
              }
            : {})}
        >
          {poateConfiguraPolitica
            ? "Deplasările deja înregistrate se văd mai jos, calculate cu politica valabilă la data lor. O deplasare NOUĂ nu se poate salva până nu există o versiune valabilă la data plecării."
            : "Deplasările deja înregistrate se văd mai jos, calculate cu politica valabilă la data lor. Pentru o deplasare nouă, cereți administratorului organizației să configureze politica firmei."}
        </Callout>
      ) : null}

      <FiltreDeplasari parametri={parametri} />

      <Suspense key={JSON.stringify(parametri)} fallback={<Schelet forma="tabel" coloane={5} />}>
        <TabelDeplasari
          organizationId={tenant.organizationId}
          parametri={parametri}
          arataAngajat={scope === "team" || scope === "all"}
        />
      </Suspense>
    </div>
  );
}
