// src/app/(app)/setari/membri/page.tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PanouMembri, type RandInvitatie, type RandMembru } from "./membri-client";
import { createServerSupabase } from "@/lib/supabase/server";
import { resolveTenant } from "@/lib/tenant/resolve-tenant";
import { formatDateTime } from "@/lib/format/date";
import { RUTA_ALEGE_ORGANIZATIA, RUTA_AUTENTIFICARE } from "@/config/routes";
import { getPermissionMap, scopeFor } from "@/lib/auth/permissions";
import { AccesRestrictionat } from "@/components/feedback/acces-restrictionat";
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

  // Pagina citea datele fără nicio verificare de permisiune: orice membru
  // autentificat al organizației le vedea. Acțiunile refuzau corect (prin
  // `createAction`), deci nu se putea MODIFICA nimic — dar divulgarea rămâne
  // divulgare, iar S2 cere verificarea și la afișare, nu doar la scriere.
  const permisiuni = await getPermissionMap(tenant.organizationId, tenant.role);
  if (scopeFor(permisiuni, "users:update") !== "all") {
    return (
      <AccesRestrictionat mesaj="Lista membrilor și invitațiile pot fi consultate doar de administratorii organizației. Cere-i administratorului tău dreptul necesar dacă ai nevoie de el." />
    );
  }

  const supabase = await createServerSupabase();
  const [membriRezultat, invitatiiRezultat] = await Promise.all([
    // Adresa de e-mail se ia într-un al doilea query, nu prin `profil:profiles(...)`.
    //
    // Încorporarea presupune că PostgREST poate deduce legătura dintre cele două
    // tabele dintr-o cheie străină. Aici nu poate: `organization_members.user_id`
    // trimite la `auth.users(id)`, nu la `public.profiles(id)`. Profilul are
    // ACEEAȘI valoare de id, dar relația nu e declarată nicăieri, iar PostgREST
    // răspunde PGRST200 „Could not find a relationship between
    // 'organization_members' and 'profiles' in the schema cache".
    //
    // Efectul era că `throw` de mai jos se declanșa DE FIECARE DATĂ: pagina nu a
    // funcționat niciodată. Nu s-a văzut fiindcă mesajul aruncat vorbește despre
    // încărcare, nu despre relație, iar frontiera de eroare arată același ecran
    // pe care l-ar arăta și o cădere de rețea.
    supabase
      .from("organization_members")
      .select("id, user_id, role, status, job_title")
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
    const cauza = membriRezultat.error ?? invitatiiRezultat.error;
    // Mesajul intern păstrează cauza reală; utilizatorul vede ecranul de eroare.
    throw new Error(
      `Lista de membri nu a putut fi încărcată: ${cauza?.message ?? "cauză necunoscută"}`,
    );
  }

  const idUtilizatori = (membriRezultat.data ?? [])
    .map((rand) => rand.user_id)
    .filter((id): id is string => id !== null);

  const profiluriRezultat =
    idUtilizatori.length === 0
      ? { data: [], error: null }
      : await supabase.from("profiles").select("id, email").in("id", idUtilizatori);

  if (profiluriRezultat.error !== null) {
    throw new Error(
      `Profilurile membrilor nu au putut fi încărcate: ${profiluriRezultat.error.message}`,
    );
  }

  const emailDupaId = new Map((profiluriRezultat.data ?? []).map((p) => [p.id, p.email] as const));

  const membri: readonly RandMembru[] = (membriRezultat.data ?? []).map((rand) => ({
    id: rand.id,
    email:
      (rand.user_id === null ? null : (emailDupaId.get(rand.user_id) ?? null)) ??
      "Adresă indisponibilă",
    role: rand.role,
    status: rand.status,
    jobTitle: rand.job_title,
    esteEu: rand.id === tenant.memberId,
  }));

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
