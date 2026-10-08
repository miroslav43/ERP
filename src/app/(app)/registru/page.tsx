// src/app/(app)/registru/page.tsx
//
// Arhiva registrului de înregistrare a documentelor.
//
// Pagina nu e un raport opțional. OMFP 2634/2015, Anexa 1, pct. 56: „Programele
// informatice utilizate în activitatea financiar-contabilă trebuie să asigure
// **listarea în orice moment** a documentelor financiar-contabile solicitate de
// organele de control." Ecranul ăsta e felul în care aplicația răspunde cererii
// aceleia — de aici și butonul de listare, care nu e o comoditate.
//
// ── CE E STARE DE URL ───────────────────────────────────────────────────────
// Tot: filtrele, sortarea (`sort`), gruparea (`grup`), pagina (`cursor`) și
// documentul deschis în panou (`doc`). Adresa se poate partaja, „înapoi" merge,
// iar niciun clic nu șterge ce era înainte — fiecare link pornește din
// parametrii EXISTENȚI (`adresa()`), ca în `/angajati`.
//
// ── DE CE GRUPAREA NU SE PAGINEAZĂ ──────────────────────────────────────────
// Cu cursor, un grup s-ar tăia la marginea paginii și angajații nu s-ar putea
// ordona după nume. Se citește tot anul filtrat (plafon explicit, marcat) și
// se grupează aici. Volumele reale: sute pe an, nu mii.

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BookMarked, ChevronLeft, ChevronRight, FolderTree, Printer } from "lucide-react";
import { z } from "zod";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { ComutatorVizualizare } from "@/components/ui/comutator-vizualizare";
import { Paginare } from "@/components/ui/paginare";
import { StareGoala } from "@/components/ui/stare-goala";
import { Tabel, type Coloana, type Grupare } from "@/components/ui/tabel";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { scrieSortare } from "@/lib/queries/cursor";
import { optiuniAngajati } from "@/lib/queries/maintenance";
import { citesteNomenclator } from "@/lib/queries/nomenclator";
import {
  citesteDocumentRegistru,
  citesteExercitiu,
  citesteSumarAn,
  listeazaAni,
  listeazaRegistru,
  listeazaRegistruComplet,
  parseazaFiltre,
  serializeazaFiltre,
  type GrupRegistru,
  type RandRegistru,
} from "@/lib/queries/registru";

import { CifreAn } from "./cifre-an";
import { DetaliuDocument } from "./detaliu-document";
import { DialogDocumentPrimit } from "./dialog-document-primit";
import { ETICHETE_SENS, TON_SENS, eticheteazaRezolvare, eticheteazaTipDocument } from "./etichete";
import { FiltreRegistru } from "./filtre-registru";
import { comparaIndicative } from "./indicativ";
import { PanouDocumentRegistru } from "./panou-document";

export const metadata: Metadata = {
  title: "Registrul documentelor",
  description: "Evidența numerelor de înregistrare, pe an.",
};

export const dynamic = "force-dynamic";

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const OPTIUNI_GRUPARE = [
  { cheie: "", eticheta: "Listă" },
  { cheie: "tip", eticheta: "Pe tip" },
  { cheie: "dosar", eticheta: "Pe dosar" },
  { cheie: "luna", eticheta: "Pe lună" },
  { cheie: "angajat", eticheta: "Pe angajat" },
] as const;

const schemaDoc = z.uuid();

/** Luna din `YYYY-MM`, cu numele ei: „Octombrie 2026". */
function numeLuna(cheie: string): string {
  const [an, luna] = cheie.split("-").map(Number);
  if (an === undefined || luna === undefined || Number.isNaN(an) || Number.isNaN(luna)) {
    return cheie;
  }
  const text = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(an, luna - 1, 1)),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default async function PaginaRegistru({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // `registru:read` e cheie PROPRIE, nu `compliance:read` refolosit: rolul `hr`
  // nu are `compliance:read` în seed, deci exact omul care emite documentele ar
  // fi văzut un registru gol, fără nicio eroare.
  if (!can(permisiuni, "registru:read", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta registrul documentelor." />
      </div>
    );
  }

  const poateLista = can(permisiuni, "registru:export", "all");
  // Aceeași cheie ca la exercițiu: cine ține registrul poate înregistra un
  // document primit pe hârtie și poate corecta clasarea în nomenclator.
  const poateScrie = can(permisiuni, "registru:update", "all");

  const brute = await searchParams;
  const filtre = parseazaFiltre(brute);
  const docBrut = Array.isArray(brute.doc) ? brute.doc[0] : brute.doc;
  const docValid = schemaDoc.safeParse(docBrut);
  const docId = docValid.success ? docValid.data : null;
  const grupat = filtre.grup !== null;

  // Organizația vine din tenant, niciodată din ce trimite clientul.
  const [pagina, complet, exercitiu, ani, sumar, angajati, nomenclator, detaliu] =
    await Promise.all([
      grupat ? null : listeazaRegistru(tenant.organizationId, filtre),
      grupat ? listeazaRegistruComplet(tenant.organizationId, filtre) : null,
      citesteExercitiu(tenant.organizationId, filtre.an),
      listeazaAni(tenant.organizationId),
      citesteSumarAn(tenant.organizationId, filtre.an),
      optiuniAngajati(tenant.organizationId),
      citesteNomenclator(tenant.organizationId),
      docId === null ? null : citesteDocumentRegistru(tenant.organizationId, docId),
    ]);

  const areFiltre =
    filtre.sens !== null ||
    filtre.tipDocument !== null ||
    filtre.deLa !== null ||
    filtre.panaLa !== null ||
    filtre.cautare !== null ||
    filtre.angajatId !== null ||
    filtre.dosar !== null ||
    filtre.stare !== null ||
    filtre.sursa !== null;

  /**
   * Adresele se construiesc din parametrii EXISTENȚI, nu dintr-un obiect gol:
   * altfel o sortare ar șterge filtrele, iar deschiderea panoului ar șterge
   * sortarea.
   */
  function adresa(schimba: (p: URLSearchParams) => void): string {
    const p = new URLSearchParams();
    for (const [cheie, valoare] of Object.entries(brute)) {
      if (typeof valoare === "string" && valoare !== "") p.set(cheie, valoare);
    }
    schimba(p);
    return p.size === 0 ? "/registru" : `/registru?${p.toString()}`;
  }
  const hrefDocument = (id: string): string => adresa((p) => p.set("doc", id));

  const continutDosar = new Map(nomenclator.map((d) => [d.indicativ, d.continut]));
  const numeAngajat = new Map(angajati.map((a) => [a.id, a.nume]));

  /* ── Rândurile de arătat: pagina, sau tot anul grupat ─────────────────── */

  const grupare = grupat ? grupareDupa(filtre.grup ?? "tip", continutDosar, numeAngajat) : null;
  const randuri: readonly RandRegistru[] =
    grupare === null
      ? (pagina?.randuri ?? [])
      : [...(complet?.randuri ?? [])].sort(
          (a, b) => grupare.compara(grupare.cheie(a), grupare.cheie(b)) || b.numar - a.numar,
        );
  const contorGrup = new Map<string, number>();
  if (grupare !== null) {
    for (const r of randuri) {
      const k = grupare.cheie(r);
      contorGrup.set(k, (contorGrup.get(k) ?? 0) + 1);
    }
  }
  const grupareTabel: Grupare<RandRegistru> | undefined =
    grupare === null
      ? undefined
      : {
          cheie: grupare.cheie,
          antet: (cheie, primul) => {
            const n = contorGrup.get(cheie) ?? 0;
            return `${grupare.eticheta(cheie, primul)} · ${n} ${n === 1 ? "document" : "documente"}`;
          },
        };

  /* ── Coloanele ────────────────────────────────────────────────────────── */

  const coloane: readonly Coloana<RandRegistru>[] = [
    {
      cheie: "numar",
      antet: "Nr. înregistrare",
      sortabil: true,
      peTelefon: "titlu",
      latime: "ingusta",
      celula: (r) => (
        <span
          className={
            r.anulatLa === null ? "font-mono" : "text-muted-foreground font-mono line-through"
          }
        >
          {r.numarAfisat}
          {r.inregistratRetroactiv ? (
            <span
              className="text-muted-foreground text-nota ml-2 no-underline"
              title="Înregistrat retroactiv, la punerea în funcțiune a registrului: numărul nu apare pe documentul tipărit."
            >
              retroactiv
            </span>
          ) : null}
        </span>
      ),
    },
    {
      cheie: "data",
      antet: "Data",
      sortabil: true,
      peTelefon: "ascuns",
      latime: "ingusta",
      celula: (r) => formatDate(r.dataInregistrare),
    },
    {
      cheie: "sens",
      antet: "Sens",
      peTelefon: "insigna",
      latime: "ingusta",
      celula: (r) => <Badge ton={TON_SENS[r.sens]}>{ETICHETE_SENS[r.sens]}</Badge>,
    },
    {
      cheie: "tip",
      antet: "Tip document",
      sortabil: true,
      peTelefon: "meta",
      celula: (r) => eticheteazaTipDocument(r.tipDocument),
    },
    {
      cheie: "continut",
      antet: "Conținut",
      peTelefon: "meta",
      celula: (r) => (
        <span className={r.anulatLa === null ? "" : "text-muted-foreground"}>
          {r.continutRezumat}
          {r.motivAnulare === null ? null : (
            <span className="text-nota block">Anulat: {r.motivAnulare}</span>
          )}
        </span>
      ),
    },
    {
      // La intrare contează cine l-a trimis; la ieșire, cui i l-am dat. O
      // singură coloană, cu rubrica potrivită sensului — ambele sunt în panou.
      cheie: "cuCine",
      antet: "Emitent / Destinatar",
      peTelefon: "ascuns",
      celula: (r) => {
        const cine = r.sens === "iesire" ? r.destinatar : r.emitent;
        return cine ?? <span className="text-muted-foreground">Necompletat</span>;
      },
    },
    {
      cheie: "nrDoc",
      antet: "Nr. document",
      peTelefon: "ascuns",
      latime: "ingusta",
      celula: (r) =>
        r.numarDocumentEmitent ?? <span className="text-muted-foreground">Necompletat</span>,
    },
    {
      // Ordin 217/1996 art. 9: indicativul dosarului după nomenclator. Gol
      // înseamnă „tip neclasat", nu o eroare — se completează „după rezolvare".
      cheie: "dosar",
      antet: "Indicativ",
      sortabil: true,
      peTelefon: "ascuns",
      latime: "ingusta",
      celula: (r) =>
        r.indicativDosar === null ? (
          <span className="text-muted-foreground">Neclasat</span>
        ) : (
          <Link
            href={`/registru/nomenclator#dosar-${r.indicativDosar}`}
            className="font-mono underline decoration-1 underline-offset-4 hover:decoration-2"
            title={continutDosar.get(r.indicativDosar) ?? "Dosarul din nomenclator"}
          >
            {r.indicativDosar}
          </Link>
        ),
    },
    {
      // Un rând per caz: răspunsul nu ia număr nou, ci închide cererea.
      cheie: "rezolvare",
      antet: "Rezolvare",
      peTelefon: "meta",
      latime: "ingusta",
      celula: (r) => (
        <span className={r.modRezolvare === null ? "text-muted-foreground" : ""}>
          {eticheteazaRezolvare(r.modRezolvare)}
          {r.dataExpedierii === null ? null : (
            <span className="text-muted-foreground text-nota block">
              {formatDate(r.dataExpedierii)}
            </span>
          )}
        </span>
      ),
    },
  ];

  /* ── Banda de cifre ───────────────────────────────────────────────────── */

  const fara = (p: URLSearchParams): void => {
    p.delete("sens");
    p.delete("stare");
    p.delete("cursor");
  };
  const cifre = [
    {
      eticheta: "Documente în " + String(filtre.an),
      valoare: sumar.total,
      href: adresa(fara),
      activ: filtre.sens === null && filtre.stare === null,
    },
    ...(["intrare", "iesire", "intern"] as const).map((s) => ({
      eticheta: ETICHETE_SENS[s],
      valoare: sumar.peSens[s],
      href: adresa((p) => {
        fara(p);
        p.set("sens", s);
      }),
      activ: filtre.sens === s,
    })),
    {
      eticheta: "În lucru",
      valoare: sumar.inLucru,
      href: adresa((p) => {
        fara(p);
        p.set("stare", "in_lucru");
      }),
      activ: filtre.stare === "in_lucru",
    },
    {
      // „Înregistrări anulate", nu „Anulate": rubrica „Rezolvare" a unei cereri
      // de concediu poate spune „Anulată" (starea cererii) fără ca RÂNDUL de
      // registru să fie anulat — două lucruri diferite, cu același cuvânt.
      eticheta: "Înregistrări anulate",
      valoare: sumar.anulate,
      href: adresa((p) => {
        fara(p);
        p.set("stare", "anulate");
      }),
      activ: filtre.stare === "anulate",
    },
  ];

  /* ── Panoul: vecinii din lista de pe ecran ────────────────────────────── */

  let subsolPanou: ReactNode = null;
  if (docId !== null) {
    const indice = randuri.findIndex((r) => r.id === docId);
    const anterior = indice > 0 ? randuri[indice - 1] : undefined;
    const urmator = indice >= 0 ? randuri[indice + 1] : undefined;
    subsolPanou = (
      <>
        {anterior === undefined ? null : (
          <Link
            href={hrefDocument(anterior.id)}
            scroll={false}
            className={buton({ varianta: "secundar" })}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            {anterior.numarAfisat}
          </Link>
        )}
        {urmator === undefined ? null : (
          <Link
            href={hrefDocument(urmator.id)}
            scroll={false}
            className={buton({ varianta: "secundar" })}
          >
            {urmator.numarAfisat}
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        )}
      </>
    );
  }

  const dosareFiltru = sumar.dosare.map((indicativ) => ({
    indicativ,
    continut: continutDosar.get(indicativ) ?? "dosar neclasat în nomenclatorul curent",
  }));

  const gol = (
    <StareGoala
      fel={areFiltre ? "filtrata" : "initiala"}
      pictograma={BookMarked}
      titlu={areFiltre ? "Niciun document pe filtrele alese" : `Registrul pe ${filtre.an} e gol`}
      descriere={
        areFiltre
          ? "Șterge filtrele ca să vezi tot registrul anului."
          : "Documentele primesc număr de înregistrare automat, pe măsură ce sunt emise. Nu s-a înregistrat încă niciunul anul acesta."
      }
    />
  );

  return (
    <div className={`${LATIMI.lista} space-y-6`}>
      <AntetPagina
        titlu="Registrul documentelor"
        descriere={`Numerele de înregistrare ale ${tenant.name}, pe anul ${filtre.an}. Numerotarea începe la 1 ianuarie și se încheie la 31 decembrie.`}
        actiuni={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/registru/nomenclator"
              className="border-border text-corp hover:bg-surface-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5"
            >
              <FolderTree aria-hidden="true" className="size-4" />
              Nomenclator
            </Link>
            {poateScrie ? <DialogDocumentPrimit angajati={angajati} /> : null}
            {poateLista ? (
              <Link
                href={`/registru/listare?${serializeazaFiltre(filtre)}`}
                target="_blank"
                rel="noopener"
                className="border-border text-corp hover:bg-surface-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5"
              >
                <Printer aria-hidden="true" className="size-4" />
                Listează registrul
              </Link>
            ) : null}
          </div>
        }
      />

      {/* Starea exercițiului. Un an închis nu mai primește înregistrări — pct. 58
          lit. h) — iar o redeschidere rămâne vizibilă permanent. */}
      {exercitiu !== null && exercitiu.stare === "inchis" ? (
        <div className="border-border bg-surface-2 text-corp rounded-panou border p-4">
          <strong className="text-foreground font-semibold">
            Exercițiul {filtre.an} este închis
          </strong>
          {exercitiu.inchisLa === null
            ? null
            : ` la ${formatDate(exercitiu.inchisLa.slice(0, 10))}`}
          {exercitiu.totalInregistrari === null
            ? null
            : `, cu ${exercitiu.totalInregistrari} înregistrări`}
          {". Nu mai pot fi înregistrate sau modificate documente pe anul acesta."}
          {exercitiu.amprenta === null ? null : (
            <div className="text-muted-foreground text-nota mt-1 font-mono">
              Amprentă: {exercitiu.amprenta}
            </div>
          )}
        </div>
      ) : null}

      {exercitiu !== null && exercitiu.redeschisLa !== null ? (
        <div className="border-warning/40 bg-warning/5 text-corp rounded-panou border p-4">
          <strong className="text-foreground font-semibold">
            Exercițiul {filtre.an} a fost redeschis
          </strong>
          {` la ${formatDate(exercitiu.redeschisLa.slice(0, 10))}.`}
          {exercitiu.motivRedeschidere === null ? null : ` Motiv: ${exercitiu.motivRedeschidere}`}
        </div>
      ) : null}

      <CifreAn cifre={cifre} />

      <FiltreRegistru ani={ani} tipuri={sumar.tipuri} angajati={angajati} dosare={dosareFiltru} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* `flex-wrap`: cinci segmente fac 424 px, iar la 390 px pagina se
            lățea cu 51 px (măsurat pe staging, 8 oct 2026). */}
        <ComutatorVizualizare
          eticheta="Grupare"
          cheieParametru="grup"
          optiuni={OPTIUNI_GRUPARE}
          curenta={filtre.grup ?? ""}
          implicita=""
          parametri={brute}
          cale="/registru"
          className="flex-wrap"
        />
        {grupat && complet !== null ? (
          <p className="text-muted-foreground text-corp">
            <span className="font-mono tabular-nums">{randuri.length}</span>
            {randuri.length === 1 ? " document" : " documente"}, în{" "}
            <span className="font-mono tabular-nums">{contorGrup.size}</span>
            {contorGrup.size === 1 ? " grup" : " grupuri"}
          </p>
        ) : null}
      </div>

      <Tabel<RandRegistru>
        caption={`Registrul documentelor pe ${filtre.an}`}
        coloane={coloane}
        randuri={randuri}
        cheieRand={(r) => r.id}
        href={(r) => hrefDocument(r.id)}
        pastreazaDerularea
        densitate="compact"
        gol={gol}
        {...(grupareTabel === undefined ? {} : { grupare: grupareTabel })}
        {...(complet?.trunchiat === true ? { trunchiat: true } : {})}
        {...(pagina === null
          ? {}
          : {
              sortare: pagina.sortare,
              hrefSortare: (s: { cheie: string; directie: "asc" | "desc" }) =>
                adresa((p) => {
                  p.set("sort", scrieSortare(s));
                  // Cursorul nu supraviețuiește unei schimbări de sortare: ar
                  // continua de la un rând care, în noua ordine, nu mai e acolo.
                  p.delete("cursor");
                }),
            })}
      />

      {pagina === null || pagina.randuri.length === 0 ? null : (
        <Paginare
          afisate={pagina.randuri.length}
          total={pagina.total}
          cursorUrmator={pagina.cursorUrmator}
          construiesteHref={({ cursor, limita }) => {
            const suplimentar: Record<string, string> = { limita: String(limita) };
            if (cursor !== null) suplimentar.cursor = cursor;
            return `/registru?${serializeazaFiltre(filtre, suplimentar)}`;
          }}
          limita={filtre.limita}
        />
      )}

      {docId === null ? null : (
        <PanouDocumentRegistru
          titlu={
            detaliu === null
              ? "Document negăsit"
              : eticheteazaTipDocument(detaliu.document.tipDocument)
          }
          {...(subsolPanou === null ? {} : { subsol: subsolPanou })}
        >
          {detaliu === null ? (
            <Callout fel="atentie" titlu="Documentul nu e vizibil în registrul firmei">
              Adresa indică un rând care nu există în registrul acestei firme sau pe care nu aveți
              dreptul să-l vedeți. Închideți panoul și alegeți un rând din listă.
            </Callout>
          ) : (
            <DetaliuDocument detaliu={detaliu} hrefDocument={hrefDocument} />
          )}
        </PanouDocumentRegistru>
      )}
    </div>
  );
}

/* ---------------------------------- grupare ------------------------------- */

type Gruparea = Readonly<{
  cheie: (r: RandRegistru) => string;
  compara: (a: string, b: string) => number;
  eticheta: (cheie: string, primul: RandRegistru) => string;
}>;

/**
 * Cheia, ordinea grupurilor și eticheta antetului, pentru fiecare grupare.
 * Ordinea e a OMULUI, nu a bazei: tipurile după denumire, dosarele după cifra
 * romană, lunile descrescător, angajații după nume, cu „fără salariat" la coadă.
 */
function grupareDupa(
  grup: GrupRegistru,
  continutDosar: ReadonlyMap<string, string>,
  numeAngajat: ReadonlyMap<string, string>,
): Gruparea {
  const ro = (a: string, b: string): number => a.localeCompare(b, "ro");
  switch (grup) {
    case "tip":
      return {
        cheie: (r) => r.tipDocument,
        compara: (a, b) => ro(eticheteazaTipDocument(a), eticheteazaTipDocument(b)),
        eticheta: (cheie) => eticheteazaTipDocument(cheie),
      };
    case "dosar":
      return {
        cheie: (r) => r.indicativDosar ?? "",
        compara: (a, b) => {
          if (a === "") return b === "" ? 0 : 1;
          if (b === "") return -1;
          return comparaIndicative(a, b);
        },
        eticheta: (cheie) =>
          cheie === ""
            ? "Neclasate în nomenclator"
            : `${cheie} — ${continutDosar.get(cheie) ?? "dosar"}`,
      };
    case "luna":
      return {
        cheie: (r) => r.dataInregistrare.slice(0, 7),
        compara: (a, b) => (a < b ? 1 : a > b ? -1 : 0),
        eticheta: (cheie) => numeLuna(cheie),
      };
    case "angajat":
      return {
        cheie: (r) => r.angajatId ?? "",
        compara: (a, b) => {
          if (a === "") return b === "" ? 0 : 1;
          if (b === "") return -1;
          return ro(numeAngajat.get(a) ?? a, numeAngajat.get(b) ?? b);
        },
        eticheta: (cheie) =>
          cheie === "" ? "Fără salariat" : (numeAngajat.get(cheie) ?? "Angajat necunoscut"),
      };
  }
}
