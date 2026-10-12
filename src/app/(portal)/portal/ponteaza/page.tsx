// src/app/(portal)/portal/ponteaza/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { QrCode } from "lucide-react";

import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { configPontareRapida, sePonteazaPeZi } from "@/domain/attendance/pontare-rapida";
import { setariPontareRapida } from "@/lib/queries/attendance";
import { requireTenant } from "@/lib/tenant/resolve-tenant";

import { DoarPeSaptamana } from "../doar-pe-saptamana";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { requireFeature } from "@/lib/auth/features";
import { can, getPermissionMap } from "@/lib/auth/permissions";

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
export default async function PaginaPonteazaCuCod() {
  /*
    Varianta săptămânală (0165): scanarea nu mai pontează, iar „ziua se
    completează cu ore" ar trimite într-un calendar care nu mai deschide nicio
    zi. Pagina rămâne instrucțiune pentru varianta zilnică; aici spune unde se
    face pontajul acum.
  */
  const { tenant } = await requireTenant();
  // Preambulul lipsea cu totul: deschisă din semn de carte după oprirea
  // modulului, pagina se randa și butonul ducea în 404.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "attendance"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);
  if (!can(permisiuni, "attendance:create", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a ponta." />
      </div>
    );
  }
  if (!sePonteazaPeZi(configPontareRapida(await setariPontareRapida(tenant.organizationId)))) {
    return (
      <div className={`${LATIMI.formular} space-y-5 p-4`}>
        <AntetPagina titlu="Pontarea cu cod" />
        <DoarPeSaptamana saptamana={null} />
      </div>
    );
  }

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
        {can(permisiuni, "attendance:read", "own") ? (
          <p>
            <Link href="/portal/pontajul-meu" className={buton({ varianta: "secundar" })}>
              Completează ziua cu ore
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
