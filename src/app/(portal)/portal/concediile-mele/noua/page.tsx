// src/app/(portal)/portal/concediile-mele/noua/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { buton } from "@/components/ui/buton";
import { StareGoala } from "@/components/ui/stare-goala";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayInBucharest } from "@/lib/format/date";
import {
  coduriIndemnizatieMedicala,
  varianteConcediu,
  zileNelucratoare,
} from "@/lib/queries/leave";
import { fisaMea, soldurileMele } from "@/lib/queries/portal";

import { FaraFisa } from "../../fara-fisa";
import { FormularCererePortal } from "./formular-cerere";

export const metadata: Metadata = { title: "Cerere de concediu" };

interface TipPentruFormular {
  readonly id: string;
  /** Cheia din bază — `medical` deschide secțiunea de certificat. */
  readonly key: string;
  readonly denumire: string;
  readonly scade_din_sold: boolean;
  readonly necesita_document: boolean;
}

export default async function PaginaCerereNouaPortal() {
  const { tenant, user } = await requireTenant();
  // Două citiri independente, pe tabele diferite. Înlănțuite erau două
  // dus-întorsuri seriale spre PostgREST; costul e integral rețea, nu bază.
  const [, permisiuni] = await Promise.all([
    requireFeature(tenant.organizationId, "leave"),
    getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId),
  ]);

  if (!can(permisiuni, "leave:create", "own")) {
    return (
      <div className="p-4">
        <AccesRestrictionat mesaj="Nu aveți dreptul de a depune cereri de concediu. Cereți-i administratorului organizației dreptul necesar." />
      </div>
    );
  }

  const stare = await fisaMea(tenant.organizationId, user.id);
  if (stare.stare !== "ok") return <FaraFisa stare={stare} numeOrganizatie={tenant.name} />;

  const an = Number(todayInBucharest().slice(0, 4));
  const db = await createServerSupabase();

  const [{ data: tipuri }, { nationale, organizatie }, solduri] = await Promise.all([
    db
      .from("leave_types")
      .select("id, key, denumire, scade_din_sold, necesita_document")
      .eq("organization_id", tenant.organizationId)
      .eq("activ", true)
      .is("deleted_at", null)
      .order("denumire")
      .returns<TipPentruFormular[]>(),
    // Anul dinainte și cel de după: o cerere depusă în decembrie se poate întinde
    // peste Anul Nou, iar sărbătorile din ianuarie schimbă numărătoarea.
    zileNelucratoare(tenant.organizationId, an - 1, an + 1),
    // Soldul propriu, filtrat EXPLICIT pe fișă — nu prin RLS. Vezi comentariul din
    // capul lui `queries/portal.ts`.
    soldurileMele(tenant.organizationId, an, stare.fisa.id),
  ]);

  // Nomenclatorul de coduri de indemnizație medicală, valabil azi. Angajatul e
  // cel care depune cel mai des concediu medical — fără codul de pe certificat,
  // indemnizația lui rămâne 0 lei, fără nicio eroare vizibilă.
  const [coduriMedicale, variante] = await Promise.all([
    coduriIndemnizatieMedicala(todayInBucharest()),
    varianteConcediu(),
  ]);

  const soldPeTip = Object.fromEntries(
    solduri.map((s) => [s.leave_type_id, s.ramase ?? 0] as const),
  );

  const sarbatoriRo = nationale.map((z) => z.data);
  const liberSuplimentar = organizatie
    .filter((z) => z.tip === "liber_suplimentar")
    .map((z) => z.data);
  const zileRecuperare = organizatie.filter((z) => z.tip === "zi_recuperare").map((z) => z.data);

  return (
    <div className={`${LATIMI.formular} space-y-4 p-4`}>
      <AntetPagina
        titlu="Cerere de concediu"
        descriere="Alegeți perioada; zilele lucrătoare se numără automat, fără sărbători legale."
      />

      {tipuri === null || tipuri.length === 0 ? (
        <StareGoala
          fel="initiala"
          pictograma={Settings}
          titlu="Nu există tipuri de concediu configurate"
          // Fără buton de configurare: `leave:update = all` e al administratorului,
          // iar un buton pe care angajatul îl apasă și primește refuz e mai rău
          // decât absența lui.
          descriere="Firma nu are niciun tip de concediu activ, deci nicio cerere nu poate fi depusă. Anunțați administratorul organizației."
        />
      ) : (
        <FormularCererePortal
          tipuri={tipuri}
          coduriMedicale={coduriMedicale}
          variante={variante}
          sarbatoriRo={sarbatoriRo}
          liberSuplimentar={liberSuplimentar}
          zileRecuperare={zileRecuperare}
          soldPeTip={soldPeTip}
        />
      )}

      <p>
        <Link href="/portal/concediile-mele" className={buton({ varianta: "link" })}>
          Înapoi la concediile mele
        </Link>
      </p>
    </div>
  );
}
