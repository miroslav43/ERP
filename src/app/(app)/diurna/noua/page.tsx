// src/app/(app)/diurna/noua/page.tsx
import type { Metadata } from "next";
import { Settings } from "lucide-react";

import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
import { AntetPagina, LATIMI } from "@/components/ui/antet-pagina";
import { StareGoala } from "@/components/ui/stare-goala";
import { cn } from "@/lib/ui/cn";
import { can, getPermissionMap } from "@/lib/auth/permissions";
import { requireFeature } from "@/lib/auth/features";
import { requireTenant } from "@/lib/tenant/resolve-tenant";
import { createServerSupabase } from "@/lib/supabase/server";
import { todayInBucharest } from "@/lib/format/date";
import { baremeleTarilor, politicaLaData, politiciOrganizatie, tari } from "@/lib/queries/per-diem";

import { FormularDeplasare } from "./formular-deplasare";

export const metadata: Metadata = { title: "Deplasare nouă" };

interface AngajatMinim {
  readonly id: string;
  readonly full_name: string;
  readonly marca: string;
}

export default async function PaginaDeplasareNoua() {
  const { tenant } = await requireTenant();
  await requireFeature(tenant.organizationId, "per_diem");
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role, tenant.memberId);

  if (!can(permisiuni, "per_diem:create", "own")) {
    return (
      <AccesRestrictionat mesaj="Nu aveți dreptul de a înregistra deplasări. Solicitați administratorului organizației rolul potrivit." />
    );
  }

  const poateConfiguraPolitica = can(permisiuni, "per_diem:update", "all");
  const azi = todayInBucharest();

  /**
   * Toate versiunile, nu doar cea de azi.
   *
   * Poarta de mai jos se închidea când politica nu era valabilă ASTĂZI — deci
   * o firmă a cărei versiune nouă intră în vigoare de luna viitoare nu putea
   * planifica nicio deplasare pentru luna viitoare, deși baza ar fi acceptat-o:
   * `internal.valideaza_deplasare` cere o politică valabilă la `plecare_la`,
   * nu la `now()`. Se închide doar când NU EXISTĂ nicio versiune, iar
   * previzualizarea alege singură versiunea potrivită datei alese.
   */
  /*
    Politicile, versiunea de azi și nomenclatorul de țări nu depind unele de
    altele — erau trei valuri puse cap la cap. `tari()` se citește și pe ramura
    în care politica lipsește, deci o interogare de nomenclator „în plus" pe un
    drum care oricum se termină într-un ecran de configurare: preț corect pentru
    trei valuri economisite pe drumul normal.
  */
  const [politici, politicaAzi, listaTari] = await Promise.all([
    politiciOrganizatie(tenant.organizationId),
    politicaLaData(tenant.organizationId, azi),
    tari(),
  ]);
  // Referința pentru țara internă implicită: versiunea de azi dacă există,
  // altfel cea mai recentă (lista vine ordonată descrescător după `valabil_de_la`).
  const politica = politicaAzi ?? politici[0] ?? null;

  if (politica === null) {
    return (
      <div className={cn(LATIMI.formular, "space-y-6")}>
        <AntetPagina titlu="Deplasare nouă" />
        <StareGoala
          fel="initiala"
          pictograma={Settings}
          titlu="Politica de diurnă nu este configurată"
          descriere={
            poateConfiguraPolitica
              ? "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Configurați pragurile și baremul firmei."
              : "Fără o politică valabilă la data plecării, nicio deplasare nu poate fi salvată. Cereți administratorului organizației să configureze politica firmei."
          }
          {...(poateConfiguraPolitica
            ? { actiune: { eticheta: "Configurează politica", href: "/diurna/politica" } }
            : {})}
        />
      </div>
    );
  }

  const poateAlegeAngajat = can(permisiuni, "per_diem:create", "all");
  const db = await createServerSupabase();

  // Baremurile chiar depind de lista de țări; angajații, nu. Un val, nu două.
  const [baremuri, angajatiRes] = await Promise.all([
    baremeleTarilor(listaTari.map((t) => t.id)),
    poateAlegeAngajat
      ? db
          .from("employees")
          .select("id, full_name, marca")
          .eq("organization_id", tenant.organizationId)
          .eq("status", "activ")
          .is("deleted_at", null)
          .order("full_name")
          .returns<AngajatMinim[]>()
      : null,
  ]);

  const angajati: readonly AngajatMinim[] | null = angajatiRes?.data ?? null;

  return (
    <div className={cn(LATIMI.detaliu, "space-y-6")}>
      <AntetPagina
        titlu="Deplasare nouă"
        descriere="Zilele și suma diurnei se calculează pe măsură ce completați formularul; suma finală se verifică din nou, exact, pe fișa deplasării, după ce adăugați etapele reale ale traseului."
      />

      <FormularDeplasare
        tari={listaTari}
        politica={politica}
        politici={politici}
        baremuri={baremuri}
        angajati={angajati}
      />
    </div>
  );
}
