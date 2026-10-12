// src/app/(portal)/portal/salariul-meu/page.tsx
import type { Metadata } from "next";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { Fluturas } from "@/components/payroll/fluturas";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { getEnabledFeatures, requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { fisaMea } from "@/lib/queries/portal";
import {
  citesteFluturasulPropriu,
  listeazaBonusuriSiRetineri,
  perioadaInregistrarii,
} from "@/lib/queries/payroll";
import { Wallet } from "lucide-react";

import { AVERTISMENT_SALARIZARE } from "../../../(app)/salarizare/etichete";

import { FaraFisa } from "../fara-fisa";

export const metadata: Metadata = { title: "Salariul meu" };

export default async function PaginaSalariulMeu() {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni, module] = await Promise.all([
    requireFeature(tenant.organizationId, "payroll"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
    getEnabledFeatures(tenant.organizationId),
  ]);

  if (!can(permisiuni, "payroll:read", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a consulta fluturașul de salariu." />
      </div>
    );
  }

  // `fisaMea`, nu `idFisaProprie`: cea din urmă doar SORTEAZĂ după `is_primary`,
  // în timp ce `app.current_employee_id()` — prin care trec toate ramurile `own`
  // din RLS — chiar îl cere. Un cont a cărui unică fișă nu e principală primea
  // altfel un ecran care îi arăta numele și nicio dată, fără nicio explicație.
  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;
  const propriaFisaId = stare.fisa.id;

  const inregistrare = await citesteFluturasulPropriu(tenant.organizationId, propriaFisaId);
  const [{ bonusuri, retineri }, perioada] =
    inregistrare === null
      ? ([{ bonusuri: [], retineri: [] }, null] as const)
      : await Promise.all([
          listeazaBonusuriSiRetineri(
            tenant.organizationId,
            inregistrare.period_id,
            inregistrare.employee_id,
          ),
          perioadaInregistrarii(tenant.organizationId, inregistrare.period_id),
        ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-foreground text-titlu font-semibold">Salariul meu</h1>

      {inregistrare === null ? (
        <StareGoala
          fel="initiala"
          pictograma={Wallet}
          titlu="Niciun fluturaș disponibil încă"
          descriere="Fluturașul apare aici după ce luna e calculată și aprobată de resurse umane."
        />
      ) : (
        <>
          <p className="text-muted-foreground border-warning/40 bg-warning/8 rounded-panou text-nota border p-3">
            {AVERTISMENT_SALARIZARE}
          </p>
          {/* Luna se citește, de la migrarea `0113_luna_fluturasului_propriu`.
              Până atunci aici scria literal `perioada={null}`, cu nota că e o
              limită a bazei: `payroll_periods_select` cerea `payroll:read =
              "all"`, iar angajatul are `own`, deci rândul cu anul și luna îi
              era refuzat tăcut. 0113 a adăugat ramura proprie — perioadele
              aprobate sau închise în care omul are chiar fluturașul lui.
              `null` rămâne posibil (o perioadă ștearsă între timp), și atunci
              `Fluturas` scrie „cel mai recent calculat" în loc să ghicească. */}
          <Fluturas
            inregistrare={inregistrare}
            bonusuri={bonusuri}
            retineri={retineri}
            perioada={perioada}
            // Zilele, orele și diurna duc la ecranele LOR din portal, prin
            // poarta fiecăruia: cine contestă o zi găsește luna fără s-o caute.
            hrefPontaj={
              perioada !== null &&
              module.has("attendance") &&
              can(permisiuni, "attendance:read", "own")
                ? `/portal/pontajul-meu?an=${String(perioada.an)}&luna=${String(perioada.luna)}`
                : null
            }
            hrefConcedii={
              module.has("leave") && can(permisiuni, "leave:read", "own")
                ? "/portal/concediile-mele"
                : null
            }
            hrefDiurna={
              module.has("per_diem") && can(permisiuni, "per_diem:read", "own")
                ? "/portal/diurna-mea"
                : null
            }
          />

          <a
            href={`/api/export/salarizare/fluturas?inregistrare=${inregistrare.id}`}
            className={buton({ varianta: "secundar" })}
          >
            Descarcă fluturașul (PDF)
          </a>
        </>
      )}
    </div>
  );
}
