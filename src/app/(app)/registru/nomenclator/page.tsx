// src/app/(app)/registru/nomenclator/page.tsx
//
// Nomenclatorul dosarelor — Ordin 217/1996 art. 10-11, după modelul din anexa nr. 1.
//
// ── DE CE ECRANUL ARATĂ CA UN TABEL, NU CA UN ARBORE ────────────────────────
// Un arbore cu compartimente pliabile ar fi mai „modern" și greșit: nomenclatorul
// se PREDĂ la Arhivele Naționale ca tabel, iar inspectorul caută pe el cu degetul.
// Cele patru rubrici din anexa 1 rămân patru coloane, în ordinea din anexă.
//
// ── DE CE INDICATIVUL E COLOANA PRINCIPALĂ ──────────────────────────────────
// Art. 11: „La înregistrarea documentelor, indicativul dosarului va figura în
// registrul de intrare-ieşire, la rubrica rezervată acestuia, CA ŞI PE FIECARE
// DOCUMENT ÎN PARTE." Indicativul e ce leagă un document de dosarul lui; restul
// tabelului există ca să-l explice.

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FolderTree } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Callout } from "@/components/ui/callout";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import { citesteAvizNomenclator, citesteNomenclator } from "@/lib/queries/nomenclator";
import { anulCurent, citesteSumarAn } from "@/lib/queries/registru";

import { eticheteazaTipDocument } from "../etichete";
import { comparaIndicative } from "../indicativ";
import { DialogAviz, DialogDosar } from "./dialoguri";
import { FiltreNomenclator } from "./filtre-nomenclator";

export const metadata: Metadata = {
  title: "Nomenclatorul dosarelor",
  description: "Clasarea documentelor pe compartimente, dosare și termene de păstrare.",
};

export const dynamic = "force-dynamic";

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Căutare fără diacritice și fără majuscule: „evaluari" găsește „Evaluări". */
const cheieCautare = (text: string): string =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export default async function PaginaNomenclator({ searchParams }: ProprietatiPagina) {
  const { tenant } = await requireTenant();
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // Aceeași cheie ca registrul: indicativul e o coloană de registru, iar cine
  // vede registrul trebuie să poată vedea și clasificarea din spatele lui.
  if (!can(permisiuni, "registru:read", "all")) {
    return <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta nomenclatorul dosarelor." />;
  }

  const poateScrie = can(permisiuni, "registru:update", "all");

  const brute = await searchParams;
  const cautareBruta = Array.isArray(brute.q) ? brute.q[0] : brute.q;
  const cautare = (cautareBruta ?? "").trim().slice(0, 120);
  const an = anulCurent();

  const [toateDosarele, aviz, sumar] = await Promise.all([
    citesteNomenclator(tenant.organizationId),
    citesteAvizNomenclator(tenant.organizationId),
    // Contorul „documente în anul curent" per dosar — aceeași citire ca banda
    // de cifre din registru.
    citesteSumarAn(tenant.organizationId, an),
  ]);

  // Ordinea pe VALOAREA cifrei romane, nu alfabetic: „IX" vine după „VIII",
  // nu înaintea lui „V". Baza o ordonează alfabetic (vezi `nomenclator.ts`).
  const ordonate = [...toateDosarele].sort((a, b) => comparaIndicative(a.indicativ, b.indicativ));

  // Filtrarea e aici, nu în bază: lista nu e paginată și se citește întreagă.
  const termen = cheieCautare(cautare);
  const dosare =
    termen === ""
      ? ordonate
      : ordonate.filter((d) =>
          cheieCautare(
            [
              d.indicativ,
              d.compartimentDenumire,
              d.subdiviziuneDenumire ?? "",
              d.continut,
              ...d.tipuri.map((t) => eticheteazaTipDocument(t)),
            ].join(" "),
          ).includes(termen),
        );

  // Compartimentul se scrie o singură dată, pe primul lui dosar — ca în anexa 1,
  // unde rubrica întâi nu se repetă pe fiecare rând.
  //
  // Steagul se calculează ÎNAINTE de randare, nu cu o variabilă mutată în `.map()`:
  // React Compiler respinge mutația unei valori din afara randării chiar și când
  // rezultatul ar fi corect, fiindcă randarea poate fi reluată sau abandonată.
  const randuri = dosare.map((d, i) => ({
    dosar: d,
    primulDinCompartiment: i === 0 || dosare[i - 1]?.compartimentCifra !== d.compartimentCifra,
  }));

  return (
    <div className={`${LATIMI.lista} space-y-6`}>
      <AntetPagina
        titlu="Nomenclatorul dosarelor"
        descriere={`Clasarea documentelor ${tenant.name} pe compartimente, dosare și termene de păstrare. Indicativul dosarului se trece în registru și pe fiecare document.`}
        actiuni={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/registru"
              className="border-border text-corp hover:bg-surface-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Înapoi la registru
            </Link>
            {poateScrie ? <DialogAviz aviz={aviz} /> : null}
          </div>
        }
      />

      {aviz?.avizatLa == null ? (
        <Callout fel="atentie" titlu="Nomenclatorul nu e confirmat de Arhivele Naționale">
          Ordinul 217/1996 art. 5 lit. a) și art. 11 cer confirmarea nomenclatorului de către
          Arhivele Naționale sau de direcția județeană. Cel de mai jos e generat din modulele
          aplicației: adaptați-l la structura firmei, apoi supuneți-l confirmării și consemnați
          avizul aici.
        </Callout>
      ) : (
        <div className="border-border bg-surface-2 text-corp rounded-panou border p-4">
          <strong className="text-foreground font-semibold">Nomenclator confirmat</strong>
          {` la ${formatDate(aviz.avizatLa)}`}
          {aviz.numarAviz === null ? null : `, cu avizul ${aviz.numarAviz}`}
          {aviz.directiaJudeteana === null ? "." : `, de ${aviz.directiaJudeteana}.`}
          {aviz.observatii === null ? null : (
            <div className="text-muted-foreground text-nota mt-1">{aviz.observatii}</div>
          )}
        </div>
      )}

      <FiltreNomenclator />

      {dosare.length === 0 ? (
        <StareGoala
          fel={termen === "" ? "initiala" : "filtrata"}
          pictograma={FolderTree}
          titlu={termen === "" ? "Nomenclatorul e gol" : "Niciun dosar nu se potrivește"}
          descriere={
            termen === ""
              ? "Firmele noi primesc automat un nomenclator generat din modulele aplicației. Dacă lipsește, contactați administratorul platformei."
              : "Căutarea se face în indicativ, compartiment, conținut și tipurile clasate. Șterge filtrul ca să vezi tot nomenclatorul."
          }
        />
      ) : (
        <div className="border-border bg-surface rounded-panou overflow-x-auto border">
          <table className="w-full text-left">
            <thead className="border-border text-eticheta text-muted-foreground border-b">
              <tr>
                <th className="px-3 py-2 font-medium">Compartiment</th>
                <th className="px-3 py-2 font-medium">Indicativ</th>
                <th className="px-3 py-2 font-medium">Conținutul dosarului</th>
                <th className="px-3 py-2 font-medium">Tipuri clasate</th>
                <th className="px-3 py-2 font-medium">Termen</th>
                <th className="px-3 py-2 text-right font-medium">Documente în {an}</th>
                {poateScrie ? <th className="sr-only px-3 py-2 font-medium">Acțiuni</th> : null}
              </tr>
            </thead>
            <tbody className="text-corp">
              {randuri.map(({ dosar: d, primulDinCompartiment: compartimentNou }) => {
                const documente = sumar.peDosar[d.indicativ] ?? 0;
                return (
                  // `id` + `target:`: linkul „Indicativ" din registru aduce aici
                  // (`#dosar-II.5`) și rândul țintit se evidențiază.
                  <tr
                    key={d.id}
                    id={`dosar-${d.indicativ}`}
                    className={`border-border/60 target:bg-primary/5 scroll-mt-24 border-b last:border-0 ${
                      compartimentNou ? "border-t-border border-t" : ""
                    }`}
                  >
                    <td className="text-muted-foreground px-3 py-2 align-top">
                      {compartimentNou ? (
                        <>
                          <span className="font-mono">{d.compartimentCifra}.</span>{" "}
                          {d.compartimentDenumire}
                        </>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-top font-mono whitespace-nowrap">
                      {d.indicativ}
                    </td>
                    <td className="px-3 py-2 align-top">{d.continut}</td>
                    <td className="text-muted-foreground text-nota px-3 py-2 align-top">
                      {d.tipuri.length === 0
                        ? "—"
                        : d.tipuri.map((t, i) => (
                            <span key={t}>
                              {i > 0 ? ", " : ""}
                              <Link
                                href={`/registru?an=${String(an)}&tip=${encodeURIComponent(t)}`}
                                className="underline-offset-2 hover:underline"
                              >
                                {eticheteazaTipDocument(t)}
                              </Link>
                            </span>
                          ))}
                    </td>
                    <td className="px-3 py-2 align-top whitespace-nowrap">{d.termenPastrare}</td>
                    <td className="px-3 py-2 text-right align-top font-mono whitespace-nowrap tabular-nums">
                      {documente === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        <Link
                          href={`/registru?an=${String(an)}&dosar=${encodeURIComponent(d.indicativ)}`}
                          className="underline decoration-1 underline-offset-4 hover:decoration-2"
                          title={`Documentele din ${d.indicativ}, în registrul pe ${String(an)}`}
                        >
                          {documente}
                        </Link>
                      )}
                    </td>
                    {poateScrie ? (
                      <td className="px-3 py-2 align-top">
                        <DialogDosar
                          dosar={{
                            id: d.id,
                            indicativ: d.indicativ,
                            continut: d.continut,
                            termenPastrare: d.termenPastrare,
                          }}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-muted-foreground text-nota">
        Termenele de păstrare livrate implicit vin din OMFP 2634/2015 pct. 38-40 — statele de
        salarii 50 de ani, celelalte documente financiar-contabile 10 ani — și din HG 1425/2006
        pentru fișele de instruire. Confirmați-le cu contabilul sau juristul înainte de a preda
        nomenclatorul spre avizare.
      </p>
    </div>
  );
}
