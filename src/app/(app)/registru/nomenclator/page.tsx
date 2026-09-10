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

import { eticheteazaTipDocument } from "../etichete";
import { DialogAviz, DialogDosar } from "./dialoguri";

export const metadata: Metadata = {
  title: "Nomenclatorul dosarelor",
  description: "Clasarea documentelor pe compartimente, dosare și termene de păstrare.",
};

export const dynamic = "force-dynamic";

export default async function PaginaNomenclator() {
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

  const [dosare, aviz] = await Promise.all([
    citesteNomenclator(tenant.organizationId),
    citesteAvizNomenclator(tenant.organizationId),
  ]);

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

      {dosare.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={FolderTree}
          titlu="Nomenclatorul e gol"
          descriere="Firmele noi primesc automat un nomenclator generat din modulele aplicației. Dacă lipsește, contactați administratorul platformei."
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
                {poateScrie ? <th className="sr-only px-3 py-2 font-medium">Acțiuni</th> : null}
              </tr>
            </thead>
            <tbody className="text-corp">
              {randuri.map(({ dosar: d, primulDinCompartiment: compartimentNou }) => {
                return (
                  <tr
                    key={d.id}
                    className={`border-border/60 border-b last:border-0 ${
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
                        : d.tipuri.map((t) => eticheteazaTipDocument(t)).join(", ")}
                    </td>
                    <td className="px-3 py-2 align-top whitespace-nowrap">{d.termenPastrare}</td>
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
