// src/app/(app)/panou/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Banknote,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  LayoutGrid,
  MessageSquare,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

import { createServerSupabase } from "@/lib/supabase/server";
import { getEnabledFeatures } from "@/lib/auth/features";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { RUTA_ALEGE_ORGANIZATIA, RUTA_AUTENTIFICARE } from "@/config/routes";
export const metadata: Metadata = { title: "Panou" };

const ICONURI: Readonly<Record<string, LucideIcon>> = {
  users: Users,
  briefcase: Briefcase,
  clock: Clock,
  "calendar-days": CalendarDays,
  "file-text": FileText,
  banknote: Banknote,
  bell: Bell,
  "message-square": MessageSquare,
  settings: Settings,
  building: Building2,
};

/**
 * Doar modulele care chiar au ecrane. Restul sunt anunțate onest ca „în
 * dezvoltare” — lista asta rămâne datoria scrisă negru pe alb, exact ca
 * `MODULE_NECONSTRUITE` din `config/navigation.test.ts`.
 */
const RUTE_IMPLEMENTATE: Readonly<Record<string, string>> = {
  nucleu: "/angajati",
  attendance: "/pontaj",
  leave: "/concedii",
  onboarding: "/onboarding",
  payroll: "/salarizare",
  per_diem: "/diurna",
  fleet: "/flota",
  maintenance: "/mentenanta",
  inventory: "/inventar",
  ssm: "/ssm",
  employee_portal: "/portal",
};

export default async function PanouPage() {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    redirect(RUTA_AUTENTIFICARE);
  }
  if (rezolvare.status !== "ok") {
    redirect(RUTA_ALEGE_ORGANIZATIA);
  }
  const { tenant } = rezolvare;

  const supabase = await createServerSupabase();
  const moduleActive = await getEnabledFeatures(tenant.organizationId);
  const chei = [...moduleActive];

  const [moduleRezultat, membriRezultat, invitatiiRezultat, organizatieRezultat] =
    await Promise.all([
      chei.length > 0
        ? supabase
            .from("features")
            .select("feature_key, denumire, descriere, icon, grup, sort_order")
            .in("feature_key", chei)
            .order("sort_order", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", tenant.organizationId)
        .eq("status", "active"),
      supabase
        .from("invitations")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", tenant.organizationId)
        .eq("status", "pending"),
      supabase
        .from("organizations")
        .select("seats_limit")
        .eq("id", tenant.organizationId)
        .maybeSingle(),
    ]);

  if (moduleRezultat.error !== null) {
    throw new Error("Modulele active nu au putut fi încărcate.");
  }

  const locuriTotale = organizatieRezultat.data?.seats_limit ?? 0;
  const membriActivi = membriRezultat.count ?? 0;
  const invitatiiPendinte = invitatiiRezultat.count ?? 0;

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        {/* Denumirea organizației este conținut de la utilizator: randată ca text (S8). */}
        <h1 className="text-foreground text-xl font-semibold">{tenant.name}</h1>
        <p className="text-muted-foreground text-sm">
          {membriActivi} din {locuriTotale} locuri ocupate
          {invitatiiPendinte > 0 ? ` · ${invitatiiPendinte} invitații în așteptare` : ""}
        </p>
      </header>

      <section aria-labelledby="titlu-module" className="flex flex-col gap-3">
        <h2 id="titlu-module" className="text-foreground text-sm font-medium">
          Module activate
        </h2>

        {(moduleRezultat.data ?? []).length === 0 ? (
          <div className="border-border rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-foreground text-sm">Niciun modul nu este activat încă.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Modulele se activează din contract. Scrieți-ne ce aveți nevoie și le pornim pentru
              organizația dumneavoastră.
            </p>
          </div>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(moduleRezultat.data ?? []).map((modul) => {
              const Icon = ICONURI[modul.icon ?? ""] ?? LayoutGrid;
              const ruta = RUTE_IMPLEMENTATE[modul.feature_key];
              const continut = (
                <>
                  <span className="flex items-center gap-2">
                    <Icon aria-hidden="true" className="text-primary h-5 w-5" />
                    <span className="text-foreground font-medium">{modul.denumire}</span>
                    {ruta === undefined ? (
                      <span className="bg-background text-warning ml-auto rounded-full px-2 py-0.5 text-[11px]">
                        În dezvoltare
                      </span>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground mt-2 block text-sm">
                    {modul.descriere ?? "Descrierea acestui modul va fi completată în curând."}
                  </span>
                  {ruta === undefined ? (
                    <span className="text-muted-foreground mt-2 block text-xs">
                      Modulul este activat pentru organizația dumneavoastră, dar ecranele lui nu
                      sunt încă publicate. Vă anunțăm când devin disponibile.
                    </span>
                  ) : null}
                </>
              );

              return (
                <li key={modul.feature_key}>
                  {ruta !== undefined ? (
                    <Link
                      href={ruta}
                      className="border-border bg-surface hover:bg-background block h-full rounded-lg border p-4 transition-colors"
                    >
                      {continut}
                    </Link>
                  ) : (
                    <div className="border-border bg-surface h-full rounded-lg border p-4 opacity-90">
                      {continut}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
