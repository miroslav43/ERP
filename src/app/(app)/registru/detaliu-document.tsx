// src/app/(app)/registru/detaliu-document.tsx
//
// Conținutul panoului unui rând de registru: rubricile art. 9 și cele trei
// legături care fac registrul folosibil — spre documentul-sursă, spre angajat,
// spre dosarul din nomenclator.
//
// Server Component, fără stare: tot ce e aici vine citit din
// `citesteDocumentRegistru`. Singura bucată de client e previzualizarea PDF,
// care se montează la cerere.
//
// Lipsurile se spun cu CUVINTE, nu cu „—" (regula din `lista-definitii.tsx`):
// „Neclasat în nomenclator" și „În lucru" înseamnă lucruri diferite de „gol".

import { Download, ExternalLink, FolderTree, User } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { ListaDefinitii, type Definitie } from "@/components/ui/lista-definitii";
import { formatDate, formatDateTime } from "@/lib/format/date";
import type { DetaliuDocument as Detaliu } from "@/lib/queries/registru";

import {
  ETICHETE_SENS,
  TON_SENS,
  eticheteazaRezolvare,
  eticheteazaSursa,
  eticheteazaTipDocument,
} from "./etichete";
import { legaturaDocument } from "./legaturi";
import { PrevizualizarePdf } from "./previzualizare-pdf";
import { poateDeschide, type ContextPorti } from "@/config/porti-ruta";

export function DetaliuDocument({
  detaliu,
  hrefDocument,
  context,
}: Readonly<{
  detaliu: Detaliu;
  /** Adresa unui alt rând, cu filtrele curente păstrate — pentru conexări. */
  hrefDocument: (id: string) => string;
  /** Modulele firmei și permisiunile celui care privește: legătura trece prin poarta ȚINTEI. */
  context: ContextPorti;
}>): ReactElement {
  const d = detaliu.document;
  const legaturaBruta = legaturaDocument({
    entitateTip: d.entitateTip,
    entitateId: d.entitateId,
    parinteId: detaliu.parinteId,
    angajatId: d.angajatId,
  });
  // `hr` vede rândul (registru:read), dar n-are per_diem, trip_sheets, vehicles,
  // maintenance; iar o firmă care a oprit un modul păstrează rândurile vechi
  // pentru totdeauna. În ambele cazuri butonul ducea în refuz sau în 404.
  const legatura =
    legaturaBruta !== null && poateDeschide(legaturaBruta.href, context) ? legaturaBruta : null;

  const rubrici: readonly Definitie[] = [
    { eticheta: "Tip document", valoare: eticheteazaTipDocument(d.tipDocument) },
    { eticheta: "Data înregistrării", valoare: formatDate(d.dataInregistrare) },
    { eticheta: "Emitent", valoare: d.emitent },
    { eticheta: "Nr. document emitent", valoare: d.numarDocumentEmitent, identificator: true },
    {
      eticheta: "Data documentului",
      valoare: d.dataDocumentEmitent === null ? null : formatDate(d.dataDocumentEmitent),
    },
    { eticheta: "Destinatar", valoare: d.destinatar },
    { eticheta: "Număr file", valoare: d.numarFile },
    { eticheta: "Număr anexe", valoare: d.numarAnexe },
    { eticheta: "Compartiment", valoare: d.compartiment },
    {
      eticheta: "Data expedierii",
      valoare: d.dataExpedierii === null ? null : formatDate(d.dataExpedierii),
    },
    { eticheta: "Modul rezolvării", valoare: eticheteazaRezolvare(d.modRezolvare) },
    {
      eticheta: "Rezolvat la",
      valoare: d.rezolvatLa === null ? null : formatDateTime(d.rezolvatLa),
    },
    { eticheta: "Sursa", valoare: eticheteazaSursa(d.entitateTip) },
    { eticheta: "Înregistrat în aplicație", valoare: formatDateTime(d.createdAt) },
  ];

  return (
    <div className="space-y-6">
      {/* ── Antetul: numărul e identitatea rândului ─────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-foreground font-mono text-2xl font-semibold">{d.numarAfisat}</p>
          <Badge ton={TON_SENS[d.sens]}>{ETICHETE_SENS[d.sens]}</Badge>
          {d.anulatLa === null ? null : <Badge ton="pericol">Anulat</Badge>}
          {d.inregistratRetroactiv ? <Badge ton="ciorna">Retroactiv</Badge> : null}
        </div>
        <p className="text-corp text-foreground mt-2">{d.continutRezumat}</p>
        {d.anulatLa === null ? null : (
          <p className="text-muted-foreground text-nota mt-1">
            Anulat la {formatDateTime(d.anulatLa)}
            {d.motivAnulare === null ? "." : `: ${d.motivAnulare}`}
          </p>
        )}
        {d.inregistratRetroactiv ? (
          <p className="text-muted-foreground text-nota mt-1">
            Înregistrat retroactiv, la punerea în funcțiune a registrului: numărul nu apare pe
            documentul tipărit.
          </p>
        ) : null}
      </section>

      {/* ── Legăturile: documentul, angajatul, dosarul ───────────────────── */}
      <section className="space-y-3">
        <h3 className="text-eticheta text-muted-foreground font-semibold tracking-wide uppercase">
          Legături
        </h3>

        <div className="flex flex-wrap items-center gap-2">
          {legatura === null ? (
            <p className="text-muted-foreground text-corp">
              {legaturaBruta === null
                ? "Documentul nu are ecran propriu în aplicație."
                : "Ecranul documentului e într-un modul oprit sau pe care nu aveți dreptul să-l deschideți."}
            </p>
          ) : (
            <>
              <Link
                href={legatura.href}
                className={buton({ varianta: "primar" })}
                {...(legatura.inFilaNoua ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {legatura.eticheta}
                {legatura.inFilaNoua ? (
                  <ExternalLink aria-hidden="true" className="size-4" />
                ) : null}
              </Link>
              {legatura.pdf === undefined ? null : (
                // `<a>` simplu, nu `Link`: ținta e un route handler care
                // întoarce un fișier, nu o pagină de preîncărcat.
                <a href={`${legatura.pdf}&descarca=1`} className={buton({ varianta: "secundar" })}>
                  <Download aria-hidden="true" className="size-4" />
                  Descarcă PDF
                </a>
              )}
            </>
          )}
        </div>
        {legatura?.pdf === undefined ? null : <PrevizualizarePdf src={legatura.pdf} />}

        <p className="text-corp flex flex-wrap items-center gap-2">
          <User aria-hidden="true" className="text-muted-foreground size-4" />
          {detaliu.angajat === null ? (
            <span className="text-muted-foreground">Documentul nu e legat de un salariat.</span>
          ) : (
            <Link
              href={`/angajati/${detaliu.angajat.id}`}
              className="text-primary underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              {detaliu.angajat.nume}
            </Link>
          )}
        </p>

        <p className="text-corp flex flex-wrap items-center gap-2">
          <FolderTree aria-hidden="true" className="text-muted-foreground size-4" />
          {detaliu.dosar === null ? (
            // Ordin 217/1996 art. 9: indicativul se completează „după rezolvarea
            // documentului" — golul e o stare legitimă, nu o eroare.
            <span className="text-muted-foreground">Neclasat în nomenclator.</span>
          ) : (
            <Link
              href={`/registru/nomenclator#dosar-${detaliu.dosar.indicativ}`}
              className="text-primary underline decoration-1 underline-offset-4 hover:decoration-2"
            >
              <span className="font-mono">{detaliu.dosar.indicativ}</span> —{" "}
              {detaliu.dosar.continut}
              <span className="text-muted-foreground">
                {" "}
                (păstrare: {detaliu.dosar.termenPastrare})
              </span>
            </Link>
          )}
        </p>
      </section>

      {/* ── Rubricile art. 9 ─────────────────────────────────────────────── */}
      <section>
        <h3 className="text-eticheta text-muted-foreground mb-3 font-semibold tracking-wide uppercase">
          Rubricile registrului
        </h3>
        <ListaDefinitii definitii={rubrici} textNecompletat="Necompletat" coloane={2} />
      </section>

      {/* ── Conexările, art. 9: „documentele care se referă la aceeași problemă" ── */}
      {detaliu.conexatLa === null && detaliu.conexate.length === 0 ? null : (
        <section className="space-y-2">
          <h3 className="text-eticheta text-muted-foreground font-semibold tracking-wide uppercase">
            Conexări
          </h3>
          {detaliu.conexatLa === null ? null : (
            <p className="text-corp">
              Conexat la{" "}
              <Link
                href={hrefDocument(detaliu.conexatLa.id)}
                scroll={false}
                className="text-primary font-mono underline decoration-1 underline-offset-4 hover:decoration-2"
              >
                {detaliu.conexatLa.numarAfisat}
              </Link>
            </p>
          )}
          {detaliu.conexate.length === 0 ? null : (
            <ul className="divide-border divide-y">
              {detaliu.conexate.map((c) => (
                <li key={c.id} className="text-corp flex flex-wrap items-baseline gap-x-2 py-1.5">
                  <Link
                    href={hrefDocument(c.id)}
                    scroll={false}
                    className="text-primary font-mono underline decoration-1 underline-offset-4 hover:decoration-2"
                  >
                    {c.numarAfisat}
                  </Link>
                  <span>{eticheteazaTipDocument(c.tipDocument)}</span>
                  <span className="text-muted-foreground text-nota">{c.continutRezumat}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
