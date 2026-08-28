// src/app/(portal)/portal/ponteaza/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { QrCode } from "lucide-react";

import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";

export const metadata: Metadata = { title: "Pontare cu cod" };

/**
 * Ce face angajatul când firma cere cod QR la pontare.
 *
 * Nu există scaner în aplicație, deliberat: aplicația de cameră a oricărui
 * telefon din ultimii ani recunoaște codurile QR singură și oferă linkul. Un
 * scaner propriu ar cere permisiunea de cameră — pe iPhone, refuzată o dată,
 * se re-cere greu — și ar dubla un lucru pe care sistemul de operare îl face
 * mai bine.
 */
export default function PaginaPonteazaCuCod() {
  return (
    <div className={`${LATIMI.formular} space-y-5 p-4`}>
      <AntetPagina
        titlu="Pontarea cu cod"
        descriere="Firma dumneavoastră cere scanarea codului de la punctul de lucru."
      />

      <section className="border-border bg-surface rounded-panou space-y-3 border p-4">
        <div className="flex items-center gap-2">
          <QrCode aria-hidden="true" className="text-primary size-5 shrink-0" />
          <h2 className="text-foreground text-corp font-semibold">Trei pași</h2>
        </div>
        <ol className="text-foreground text-corp list-decimal space-y-2 pl-5">
          <li>Deschideți aplicația de cameră a telefonului.</li>
          <li>Îndreptați-o spre afișul de la intrare, fără să apăsați nimic.</li>
          <li>Apăsați linkul care apare pe ecran. Se deschide direct pontarea.</li>
        </ol>
        <p className="text-muted-foreground text-nota">
          Dacă nu apare niciun link, curățați lentila camerei sau apropiați-vă de afiș. Codul
          funcționează și pe întuneric, dacă aprindeți lanterna.
        </p>
      </section>

      <section className="border-border bg-surface rounded-panou space-y-2 border p-4">
        <h2 className="text-foreground text-corp font-semibold">Dacă nu merge</h2>
        <p className="text-muted-foreground text-corp">
          Afișul poate fi vechi: codul se schimbă când firma îl rotește, iar afișele tipărite
          înainte nu mai funcționează. Cereți unul nou responsabilului. Până atunci, ziua se
          completează cu ore, ca înainte.
        </p>
        <p>
          <Link href="/portal/pontajul-meu" className={buton({ varianta: "secundar" })}>
            Completează ziua cu ore
          </Link>
        </p>
      </section>
    </div>
  );
}
