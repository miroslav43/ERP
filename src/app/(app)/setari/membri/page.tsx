// src/app/(app)/setari/membri/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PanouMembri, type RandInvitatie, type RandMembru } from "./membri-client";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { RUTA_ALEGE_ORGANIZATIA, RUTA_AUTENTIFICARE } from "@/config/routes";
export const metadata: Metadata = { title: "Membri și invitații" };

export default async function SetariMembriPage() {
  const rezolvare = await resolveTenant();
  if (rezolvare.status === "neautentificat") {
    redirect(RUTA_AUTENTIFICARE);
  }
  if (rezolvare.status !== "ok") {
    redirect(RUTA_ALEGE_ORGANIZATIA);
  }
  const { tenant } = rezolvare;

  const supabase = await createServerSupabase();
  const [membriRezultat, invitatiiRezultat] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, user_id, role, status, job_title, profil:profiles(id, email)")
      .eq("organization_id", tenant.organizationId)
      .order("role", { ascending: true }),
    supabase
      .from("invitations")
      .select("id, email, role, expires_at")
      .eq("organization_id", tenant.organizationId)
      .eq("status", "pending")
      .order("expires_at", { ascending: true }),
  ]);

  if (membriRezultat.error !== null || invitatiiRezultat.error !== null) {
    throw new Error("Lista de membri nu a putut fi încărcată.");
  }

  const membri: readonly RandMembru[] = (membriRezultat.data ?? []).map((rand) => {
    const profil = Array.isArray(rand.profil) ? rand.profil[0] : rand.profil;
    return {
      id: rand.id,
      email: profil?.email ?? "Adresă indisponibilă",
      role: rand.role,
      status: rand.status,
      jobTitle: rand.job_title,
      esteEu: rand.id === tenant.memberId,
    };
  });

  const invitatii: readonly RandInvitatie[] = (invitatiiRezultat.data ?? []).map((rand) => ({
    id: rand.id,
    email: rand.email,
    role: rand.role,
    expiraLa: formatDateTime(new Date(rand.expires_at)),
  }));

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-foreground text-xl font-semibold">Membri și invitații</h1>
        <p className="text-muted-foreground text-sm">
          Persoanele care au acces la {tenant.name}. Rolul stabilește ce module și ce date poate
          vedea fiecare.
        </p>
      </header>
      <PanouMembri membri={membri} invitatii={invitatii} />
    </main>
  );
}
