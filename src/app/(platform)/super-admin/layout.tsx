import type { ReactNode } from "react";

import { requirePlatformAdmin } from "@/lib/auth/platform";
import { createServerSupabase } from "@/lib/supabase/server";

import { AntetPlatforma } from "./_components/antet-platforma";
import { RailPlatforma } from "./_components/rail-platforma";
import { plexMono, plexSans } from "./_lib/fonturi";
import { sumarPlatforma } from "./organizatii/actions";

/**
 * Scheletul consolei de platformă.
 *
 * Zona e navy-dominantă, spre deosebire de aplicația de firmă, care rămâne crem.
 * Nu e preferință vizuală: culoarea e semnalul care îți spune în ce plan te
 * afli, fără să fie nevoie de un banner care să explice.
 */
export default async function LayoutSuperAdmin({ children }: { children: ReactNode }) {
  // Poarta principală: nimic din acest segment nu se randează fără verificare
  // server-side. Se repetă în FIECARE Server Action din zonă — un layout nu
  // protejează o Server Action, sunt puncte de intrare separate.
  const utilizator = await requirePlatformAdmin();
  const supabase = await createServerSupabase();

  const [sumar, apartenente] = await Promise.all([
    sumarPlatforma(),
    // Clientul de sesiune: RLS filtrează singură rândurile utilizatorului curent.
    supabase
      .from("organization_members")
      .select("organization_id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const totalOrganizatii = Object.values(sumar.organizatii).reduce(
    (total, valoare) => total + valoare,
    0,
  );

  return (
    <div
      className={`${plexSans.variable} ${plexMono.variable} bg-navy-abis flex min-h-dvh flex-col md:flex-row`}
      style={{ fontFamily: "var(--font-consola)" }}
    >
      <RailPlatforma numarOrganizatii={totalOrganizatii} numarCereriNoi={sumar.cereriDemoNoi} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AntetPlatforma
          titlu="Consolă de platformă"
          email={utilizator.email}
          areFirme={(apartenente.count ?? 0) > 0}
        />
        <main id="continut" className="bg-background min-w-0 flex-1 p-5">
          {children}
        </main>
      </div>
    </div>
  );
}
