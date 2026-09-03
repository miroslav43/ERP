// src/app/(app)/angajati/sabloane-documente/page.tsx
import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { Badge } from "@/components/ui/badge";
import { buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { listeazaSabloaneDocumente } from "@/lib/queries/sabloane-documente";
import { CODURI_INROLARE, ETICHETE_SABLON, esteCodInrolare } from "@/lib/documents/variabile";

import { ButonRestabilesteSablon } from "./buton-restabileste";

export const metadata: Metadata = { title: "Șabloane de documente" };

export default async function PaginaSabloaneDocumente() {
  const { tenant } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "nucleu"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  // Aceeași poartă ca la scriere: `hr_templates_insert`/`_update` cer
  // `employees` la scope `all`. O pagină vizibilă unui rol care n-ar putea
  // salva ar fi un ecran care refuză abia la apăsarea butonului.
  if (!can(permisiuni, "employees:update", "all")) {
    return (
      <div>
        <AccesRestrictionat mesaj="Nu aveți dreptul de a modifica șabloanele de documente." />
      </div>
    );
  }

  const supabase = await createServerSupabase();
  const toate = await listeazaSabloaneDocumente(supabase, tenant.organizationId);

  /*
   * Doar cele cinci coduri ale înrolării.
   *
   * Tabela mai conține trei adeverințe, dar `genereazaAdeverinta` n-are niciun
   * apelant în `src/app/` — un editor peste ele ar fi configurare pentru un
   * ecran care nu există. Ordinea e cea de emitere, din `CODURI_INROLARE`.
   */
  const sabloane = CODURI_INROLARE.map((cod) => toate.find((s) => s.cod === cod)).filter(
    (s): s is NonNullable<typeof s> => s !== undefined && esteCodInrolare(s.cod),
  );

  const aleFirmei = sabloane.filter((s) => s.organization_id !== null).length;

  return (
    <div className={`${LATIMI.detaliu} space-y-6`}>
      <AntetPagina
        titlu="Șabloane de documente"
        descriere="Textele din care se generează contractul, fișa postului și anexele. Modificarea se aplică documentelor emise DE ACUM ÎNAINTE — cele deja emise păstrează textul cu care au fost emise."
        firimituri={[{ eticheta: "Angajați", href: "/angajati" }, { eticheta: "Șabloane" }]}
      />

      <Callout fel="atentie" titlu="Textele nu sunt avizate juridic">
        Șabloanele livrate cu aplicația sunt un punct de plecare rezonabil, nu un model verificat de
        un jurist. Înainte de a le folosi la contracte reale, dați-le spre confirmare consilierului
        dumneavoastră juridic — cu atât mai mult după ce le modificați.
      </Callout>

      <ul className="divide-border border-border rounded-panou divide-y border">
        {sabloane.map((sablon) => {
          const alFirmei = sablon.organization_id !== null;
          return (
            <li
              key={sablon.cod}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {ETICHETE_SABLON[sablon.cod as (typeof CODURI_INROLARE)[number]]}
                  </span>
                  <Badge ton={alFirmei ? "succes" : "neutru"}>
                    {alFirmei ? "Șablonul firmei" : "Șablon de platformă"}
                  </Badge>
                </p>
                <p className="text-muted-foreground text-nota mt-1">
                  Seria {sablon.serie} · {String(sablon.continut_html.length)} de caractere
                  {alFirmei ? "" : " · se folosește varianta comună, nemodificată"}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {alFirmei ? <ButonRestabilesteSablon cod={sablon.cod} /> : null}
                <Link
                  href={`/angajati/sabloane-documente/${sablon.cod}`}
                  className={buton({ varianta: "secundar" })}
                >
                  {alFirmei ? "Editează" : "Personalizează"}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>

      {aleFirmei === 0 ? (
        <p className="text-muted-foreground text-nota flex items-center gap-2">
          <FileText aria-hidden="true" className="size-4 shrink-0" />
          Firma nu are încă niciun șablon propriu. Prima salvare creează o copie a textului de
          platformă, pe care o puteți modifica oricând.
        </p>
      ) : null}
    </div>
  );
}
