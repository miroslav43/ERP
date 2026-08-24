// src/app/(app)/evaluari/page.tsx

/**
 * Pagina-gazdă a modulului.
 *
 * ── DE CE E NOUĂ ──────────────────────────────────────────────────────────
 * `/evaluari` nu avea `page.tsx`. Faptul era cunoscut și documentat ca
 * excepție în `breadcrumb.tsx`: „`/setari` și `/evaluari` sunt singurele
 * prefixe din tot `(app)` fără `page.tsx`". Meniul sărea direct la
 * `/evaluari/sabloane`, iar firimitura „Evaluări" se randa ca text mort.
 *
 * Consecința de fond nu era firimitura, ci că modulul nu avea nicio listă:
 * evaluările existau doar pe fișa fiecărui angajat, deci întrebarea „pe cine
 * am evaluat anul ăsta" n-avea niciun ecran care s-o răspundă.
 */

import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Indicator } from "@/components/ui/indicator";
import { Nivel } from "@/components/ui/nivel";
import { Paginare } from "@/components/ui/paginare";
import { Schelet } from "@/components/ui/schelet";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { formatDate } from "@/lib/format/date";
import { scrieSortare } from "@/lib/queries/cursor";
import { indicatoriEvaluari, listeazaEvaluari, listeazaSabloane } from "@/lib/queries/evaluari";
import { filtreDinUrl } from "@/lib/rute/parametri";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { filtreEvaluariSchema } from "@/schemas/evaluation";

import { FileEvaluari } from "./_components/file-evaluari";
import { ETICHETE_STATUS_EVALUARE, TONURI_STATUS_EVALUARE, tonPunctaj } from "./etichete";
import { FiltreEvaluari } from "./filtre-evaluari";

export const metadata: Metadata = { title: "Evaluări" };

/** Sub prag se arată numere absolute, nu procente — regula panoului. */
const PRAG_PROCENTE = 25;

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function BandaIndicatori({ organizationId }: { readonly organizationId: string }) {
  // Anul se ia din ceasul serverului o singură dată, în componenta care îl
  // folosește: calculat în `page`, ar fi trebuit trecut prin trei niveluri.
  const anul = new Date().getFullYear();
  const i = await indicatoriEvaluari(organizationId, anul);
  const micaFirma = i.angajatiActivi < PRAG_PROCENTE;

  return (
    <section aria-labelledby="titlu-indicatori-evaluari" className="space-y-3">
      <h2
        id="titlu-indicatori-evaluari"
        className="text-eticheta text-foreground font-semibold tracking-wide uppercase"
      >
        Anul {anul}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Indicator
          eticheta="Evaluări finalizate"
          valoare={i.finalizateAnulAcesta}
          nota={i.total === 0 ? "nicio evaluare încă" : `${String(i.total)} în total`}
        />
        <Indicator
          eticheta="Ciorne de terminat"
          valoare={i.ciorne}
          ton={i.ciorne > 0 ? "atentie" : "neutru"}
          nota={i.ciorne === 0 ? "nimic în lucru" : "deschideți-le din listă"}
          {...(i.ciorne > 0 ? { href: "/evaluari?status=draft" } : {})}
        />
        <Indicator
          eticheta="Angajați evaluați"
          // Pe opt angajați, „12,5 %" e o cifră care sună precis și nu e. Sub
          // prag se arată oamenii, nu procentul lor.
          valoare={
            micaFirma
              ? `${String(i.angajatiEvaluati)} din ${String(i.angajatiActivi)}`
              : i.angajatiActivi === 0
                ? "—"
                : `${String(Math.round((i.angajatiEvaluati / i.angajatiActivi) * 100))} %`
          }
          esteCuvant={micaFirma}
          nota={micaFirma ? "cu cel puțin o evaluare finalizată" : "din angajații activi"}
        />
        <Indicator
          eticheta="Punctaj mediu"
          valoare={i.mediaProcent === null ? "—" : `${String(i.mediaProcent)} %`}
          esteCuvant={i.mediaProcent === null}
          ton={tonPunctaj(i.mediaProcent) === "rau" ? "pericol" : "neutru"}
          nota={
            i.mediaProcent === null
              ? "nicio evaluare finalizată"
              : i.esantionTrunchiat
                ? "pe cele mai recente 200 de evaluări"
                : "pe evaluările finalizate"
          }
        />
      </div>
    </section>
  );
}

async function ListaEvaluari({
  organizationId,
  parametri,
  poateEvalua,
}: {
  readonly organizationId: string;
  readonly parametri: Record<string, string | string[] | undefined>;
  readonly poateEvalua: boolean;
}) {
  const filtre = filtreDinUrl(filtreEvaluariSchema, parametri);
  const [{ randuri, urmatorulCursor, total, sortare }, sabloane] = await Promise.all([
    listeazaEvaluari(organizationId, filtre),
    listeazaSabloane(organizationId, { includeArhivate: true }),
  ]);

  /** Adresele pornesc din parametrii EXISTENȚI: o sortare nu șterge filtrele. */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(parametri)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/evaluari" : `/evaluari?${p.toString()}`;
  }

  const areFiltre =
    filtre.status !== null ||
    filtre.template_id !== null ||
    filtre.de_la !== null ||
    filtre.pana_la !== null;

  const coloane: readonly Coloana<(typeof randuri)[number]>[] = [
    {
      cheie: "angajat",
      antet: "Angajat",
      sortabil: true,
      peTelefon: "titlu",
      celula: (e) =>
        // Embed-ul poate fi NULL chiar cu `employee_id` completat: politica de
        // SELECT de pe `employees` se aplică și în interiorul embed-ului.
        e.angajat === null ? (
          <span className="text-muted-foreground">Fișă inaccesibilă</span>
        ) : (
          <Link href={`/angajati/${e.employee_id}`} className="underline-offset-2 hover:underline">
            {e.angajat}
          </Link>
        ),
    },
    {
      cheie: "sablon",
      antet: "Șablon",
      peTelefon: "meta",
      celula: (e) => e.sablon ?? "Șablon șters",
    },
    {
      cheie: "data",
      antet: "Data",
      sortabil: true,
      latime: "ingusta",
      peTelefon: "meta",
      celula: (e) => formatDate(e.data_evaluarii),
    },
    {
      cheie: "punctaj",
      antet: "Punctaj",
      peTelefon: "meta",
      celula: (e) =>
        e.punctaj.procent === null ? (
          <span className="text-muted-foreground">nenotată</span>
        ) : (
          <Nivel
            valoare={e.punctaj.procent}
            din={100}
            marime="subtire"
            ton={tonPunctaj(e.punctaj.procent)}
            eticheta={`Punctajul evaluării din ${formatDate(e.data_evaluarii)}`}
            text={
              e.punctaj.necompletate === 0
                ? `${String(e.punctaj.procent)} %`
                : `${String(e.punctaj.procent)} % pe ${String(e.punctaj.completate)} din ${String(e.nrCriterii)} criterii`
            }
          />
        ),
    },
    {
      cheie: "status",
      antet: "Stare",
      sortabil: true,
      peTelefon: "insigna",
      celula: (e) => (
        <Badge ton={TONURI_STATUS_EVALUARE[e.status]}>{ETICHETE_STATUS_EVALUARE[e.status]}</Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <FiltreEvaluari
        filtre={filtre}
        sabloane={sabloane.map((s) => ({ id: s.id, denumire: s.denumire }))}
      />

      {randuri.length === 0 ? (
        <StareGoala
          fel={areFiltre ? "filtrata" : "initiala"}
          pictograma={ClipboardCheck}
          titlu={areFiltre ? "Niciun rezultat pentru filtrele alese" : "Nicio evaluare încă"}
          descriere={
            areFiltre
              ? "Ștergeți filtrele ca să vedeți toate evaluările."
              : poateEvalua
                ? "O evaluare se pornește de pe fișa angajatului, cu unul dintre șabloanele firmei."
                : "Evaluările apar aici pe măsură ce managerii le completează."
          }
          {...(areFiltre
            ? {
                actiune: {
                  eticheta: "Șterge filtrele",
                  // Nu `/evaluari` gol: butonul șterge FILTRELE, nu ordinea
                  // aleasă din antet și nici mărimea de pagină.
                  href: adresa((p) => {
                    for (const c of ["status", "template_id", "de_la", "pana_la", "cursor"]) {
                      p.delete(c);
                    }
                  }),
                },
              }
            : sabloane.length === 0
              ? { actiune: { eticheta: "Creează un șablon", href: "/evaluari/sabloane" } }
              : {})}
        />
      ) : (
        <>
          <Tabel
            caption="Evaluările angajaților din organizație."
            coloane={coloane}
            randuri={randuri}
            cheieRand={(e) => e.id}
            sortare={sortare}
            hrefSortare={(s) =>
              adresa((p) => {
                p.set("sort", scrieSortare(s));
                // Cursorul nu supraviețuiește unei schimbări de sortare: ar
                // continua de la un rând care, în noua ordine, nu mai e acolo.
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
        </>
      )}
    </div>
  );
}

export default async function PaginaEvaluari({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "evaluations");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "evaluations:read", "team")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta evaluările." />;
  }

  const parametri = await searchParams;
  const poateEvalua = can(permisiuni, "evaluations:create", "team");

  return (
    <div className="space-y-6">
      <AntetPagina
        titlu="Evaluări"
        descriere="Evaluările angajaților, cu punctajul calculat din criteriile șablonului folosit la completare."
        file={<FileEvaluari activa="evaluari" />}
      />

      <Suspense fallback={<Schelet forma="carduri" randuri={4} />}>
        <BandaIndicatori organizationId={tenant.organizationId} />
      </Suspense>

      <Suspense fallback={<Schelet forma="tabel" randuri={8} coloane={5} />}>
        <ListaEvaluari
          organizationId={tenant.organizationId}
          parametri={parametri}
          poateEvalua={poateEvalua}
        />
      </Suspense>
    </div>
  );
}
