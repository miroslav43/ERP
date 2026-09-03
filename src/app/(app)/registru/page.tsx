// src/app/(app)/registru/page.tsx
//
// Arhiva registrului de înregistrare a documentelor.
//
// Pagina nu e un raport opțional. OMFP 2634/2015, Anexa 1, pct. 56: „Programele
// informatice utilizate în activitatea financiar-contabilă trebuie să asigure
// **listarea în orice moment** a documentelor financiar-contabile solicitate de
// organele de control." Ecranul ăsta e felul în care aplicația răspunde cererii
// aceleia — de aici și butonul de listare, care nu e o comoditate.

import type { Metadata } from "next";
import Link from "next/link";
import { BookMarked, Printer } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { Paginare } from "@/components/ui/paginare";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { formatDate } from "@/lib/format/date";
import {
  citesteExercitiu,
  listeazaAni,
  listeazaRegistru,
  listeazaTipuriDocument,
  parseazaFiltre,
  serializeazaFiltre,
} from "@/lib/queries/registru";

import { ETICHETE_SENS, eticheteazaTipDocument } from "./etichete";
import { FiltreRegistru } from "./filtre-registru";

export const metadata: Metadata = {
  title: "Registrul documentelor",
  description: "Evidența numerelor de înregistrare, pe an.",
};

export const dynamic = "force-dynamic";

interface ProprietatiPagina {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const TON_SENS = {
  intrare: "neutru",
  iesire: "succes",
  intern: "ciorna",
} as const;

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

  const brute = await searchParams;
  const filtre = parseazaFiltre(brute);

  // Organizația vine din tenant, niciodată din ce trimite clientul.
  const [pagina, exercitiu, ani, tipuri] = await Promise.all([
    listeazaRegistru(tenant.organizationId, filtre),
    citesteExercitiu(tenant.organizationId, filtre.an),
    listeazaAni(tenant.organizationId),
    listeazaTipuriDocument(tenant.organizationId, filtre.an),
  ]);

  const areFiltre =
    filtre.sens !== null ||
    filtre.tipDocument !== null ||
    filtre.deLa !== null ||
    filtre.panaLa !== null ||
    filtre.cautare !== null;

  const construiesteHref = ({
    cursor,
    limita,
  }: Readonly<{ cursor: string | null; limita: number }>): string => {
    const suplimentar: Record<string, string> = { limita: String(limita) };
    if (cursor !== null) suplimentar.cursor = cursor;
    return `/registru?${serializeazaFiltre(filtre, suplimentar)}`;
  };

  return (
    <div className={`${LATIMI.lista} space-y-6`}>
      <AntetPagina
        titlu="Registrul documentelor"
        descriere={`Numerele de înregistrare ale ${tenant.name}, pe anul ${filtre.an}. Numerotarea începe la 1 ianuarie și se încheie la 31 decembrie.`}
        actiuni={
          poateLista ? (
            <Link
              href={`/registru/listare?${serializeazaFiltre(filtre)}`}
              target="_blank"
              rel="noopener"
              className="border-border text-corp hover:bg-surface-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5"
            >
              <Printer aria-hidden="true" className="size-4" />
              Listează registrul
            </Link>
          ) : undefined
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

      <FiltreRegistru ani={ani} tipuri={tipuri} />

      {pagina.randuri.length === 0 ? (
        <StareGoala
          fel={areFiltre ? "filtrata" : "initiala"}
          pictograma={BookMarked}
          titlu={
            areFiltre ? "Niciun document pe filtrele alese" : `Registrul pe ${filtre.an} e gol`
          }
          descriere={
            areFiltre
              ? "Șterge filtrele ca să vezi tot registrul anului."
              : "Documentele primesc număr de înregistrare automat, pe măsură ce sunt emise. Nu s-a înregistrat încă niciunul anul acesta."
          }
        />
      ) : (
        <>
          <div className="border-border bg-surface rounded-panou overflow-x-auto border">
            <table className="w-full text-left">
              <thead className="border-border text-eticheta text-muted-foreground border-b">
                <tr>
                  <th className="px-3 py-2 font-medium">Nr. înregistrare</th>
                  <th className="px-3 py-2 font-medium">Sens</th>
                  <th className="px-3 py-2 font-medium">Tip document</th>
                  <th className="px-3 py-2 font-medium">Conținut</th>
                  <th className="px-3 py-2 font-medium">Nr. document</th>
                  <th className="px-3 py-2 font-medium">Destinatar</th>
                </tr>
              </thead>
              <tbody className="text-corp">
                {pagina.randuri.map((r) => (
                  <tr
                    key={r.id}
                    className={`border-border/60 border-b last:border-0 ${
                      r.anulatLa === null ? "" : "text-muted-foreground line-through"
                    }`}
                  >
                    <td className="px-3 py-2 font-mono whitespace-nowrap">
                      {r.numarAfisat}
                      {r.inregistratRetroactiv ? (
                        <span
                          className="text-muted-foreground text-nota ml-2"
                          title="Înregistrat retroactiv, la punerea în funcțiune a registrului: numărul nu apare pe documentul tipărit."
                        >
                          retroactiv
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <Badge ton={TON_SENS[r.sens]}>{ETICHETE_SENS[r.sens]}</Badge>
                    </td>
                    <td className="px-3 py-2">{eticheteazaTipDocument(r.tipDocument)}</td>
                    <td className="px-3 py-2">
                      {r.continutRezumat}
                      {r.motivAnulare === null ? null : (
                        <div className="text-muted-foreground text-nota">
                          Anulat: {r.motivAnulare}
                        </div>
                      )}
                    </td>
                    <td className="text-muted-foreground px-3 py-2 whitespace-nowrap">
                      {r.numarDocumentEmitent ?? "—"}
                    </td>
                    <td className="px-3 py-2">{r.destinatar ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Paginare
            afisate={pagina.randuri.length}
            total={pagina.total}
            cursorUrmator={pagina.cursorUrmator}
            construiesteHref={construiesteHref}
            limita={filtre.limita}
          />
        </>
      )}
    </div>
  );
}
