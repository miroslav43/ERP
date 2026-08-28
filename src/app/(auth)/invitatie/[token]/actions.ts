// src/app/(auth)/invitatie/[token]/actions.ts
"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createServerSupabase } from "@/lib/supabase/server";
import { signTenantCookie } from "@/lib/tenant/tenant-cookie";
import { TENANT_COOKIE } from "@/lib/tenant/tenant-cookie";
import { consumeRateLimit } from "@/lib/utils/rate-limit";
import { parolaNouaSchema, tokenInvitatieSchema } from "@/schemas/auth";
import { RUTA_DUPA_AUTENTIFICARE } from "@/config/routes";

/**
 * ── UN SINGUR E-MAIL, DE LA NOI ─────────────────────────────────────────────
 * Fluxul de dinainte cerea DOUĂ mesaje: unul de invitație (prin Resend, frumos)
 * și, după ce omul deschidea linkul, încă unul de la mailerul intern Supabase —
 * „Confirm your email address", în engleză, cu linkul construit din `Site URL`-ul
 * proiectului, adică `http://localhost:3000`. Al doilea mesaj nu doar arăta
 * rău: nu ducea nicăieri.
 *
 * Acum invitatul deschide linkul primit, își pune parola, iar contul se creează
 * pe loc. Adresa e considerată confirmată fiindcă tokenul a ajuns la ea —
 * `email_confirm: true` la creare — deci Supabase n-are ce trimite.
 */

const rezultatAcceptare = z.object({
  organization_id: z.uuid(),
  organization_name: z.string().min(1),
});

/**
 * Oglinda exactă a lui `internal.sha256_hex`: `encode(digest(t,'sha256'),'hex')`.
 * În bază stă doar hash-ul; tokenul în clar există numai în e-mail și în URL.
 */
const hashToken = (token: string): string =>
  createHash("sha256").update(token, "utf8").digest("hex");

async function ipClient(): Promise<string> {
  const antet = await headers();
  return antet.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "necunoscut";
}

/**
 * Creează contul cu parola aleasă și acceptă invitația, într-un singur gest.
 *
 * ── ORDINEA CONTEAZĂ ────────────────────────────────────────────────────────
 * Contul se creează întâi, apoi se deschide o sesiune cu chiar parola pusă,
 * fiindcă `accept_invitation` rulează CA UTILIZATOR: compară `auth.email()` cu
 * adresa din invitație. Fără sesiune, funcția refuză cu PT401.
 *
 * La final sesiunea se închide și omul e trimis la autentificare. Pare un pas
 * în plus, dar e cel care dovedește că parola scrisă chiar funcționează — mai
 * bine acum, pe un ecran care explică, decât peste o săptămână.
 */
export async function creeazaContSiAccepta(formData: FormData): Promise<void> {
  const token = tokenInvitatieSchema.safeParse(formData.get("token"));
  if (!token.success) redirect("/autentificare?eroare=link");
  const catre = `/invitatie/${token.data}`;

  const parole = parolaNouaSchema.safeParse({
    parola: formData.get("parola"),
    confirmare: formData.get("confirmare"),
  });
  if (!parole.success) {
    // Un singur cod pentru „prea scurtă" și „nu coincid" ar ascunde care e
    // problema, iar omul ar reîncerca aceeași parolă. Sunt distincte.
    const cod = parole.error.issues.some((p) => p.path[0] === "confirmare")
      ? "confirmare"
      : "parola";
    redirect(`${catre}?eroare=${cod}`);
  }

  const limita = await consumeRateLimit({
    key: `invitatie-cont:ip:${await ipClient()}`,
    limit: 10,
    windowSeconds: 900,
  });
  if (!limita.allowed) redirect(`${catre}?eroare=limita`);

  /*
   * `createAdminSupabase` — permis în `actions.ts` — pentru DOUĂ lucruri pe
   * care un client de sesiune nu le poate face: citirea adresei invitate (nu e
   * expusă public, tocmai ca tokenul să nu fie oracol) și crearea contului.
   * Filtrul e `token_hash`, adică un secret, nu `organization_id`: aici nu
   * există încă niciun tenant de restrâns.
   */
  const admin = createAdminSupabase();
  const { data: invitatie, error: eroareInvitatie } = await admin
    .from("invitations")
    .select("id, email, status, expires_at")
    .eq("token_hash", hashToken(token.data))
    .is("deleted_at", null)
    .maybeSingle();

  if (eroareInvitatie !== null || invitatie === null) redirect(`${catre}?eroare=invalida`);
  if (invitatie.status !== "pending") redirect(`${catre}?eroare=invalida`);
  if (new Date(invitatie.expires_at) <= new Date()) redirect(`${catre}?eroare=invalida`);

  const { error: eroareCreare } = await admin.auth.admin.createUser({
    email: invitatie.email,
    password: parole.data.parola,
    // Posesia tokenului DOVEDEȘTE adresa: a ajuns acolo prin e-mail. Fără asta,
    // Supabase ar trimite încă un mesaj de confirmare — exact cel de care
    // scăpăm — iar `accept_invitation` ar refuza pentru `email_confirmed_at`
    // gol.
    email_confirm: true,
  });

  if (eroareCreare !== null) {
    // Cazul obișnuit: adresa are deja cont (invitație într-o a doua firmă).
    // Nu e o eroare de sistem, e un alt drum — și pagina îl arată.
    const areCont = /already|exist|registered/i.test(eroareCreare.message);
    redirect(`${catre}?eroare=${areCont ? "are-cont" : "creare"}`);
  }

  const supabase = await createServerSupabase();
  const { error: eroareIntrare } = await supabase.auth.signInWithPassword({
    email: invitatie.email,
    password: parole.data.parola,
  });
  if (eroareIntrare !== null) redirect(`${catre}?eroare=creare`);

  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token.data });
  if (error) {
    const cod = /EMAIL/i.test(error.message) ? "alta-adresa" : "invalida";
    await supabase.auth.signOut();
    redirect(`${catre}?eroare=${cod}`);
  }

  const rezultat = rezultatAcceptare.safeParse(data);
  if (!rezultat.success) {
    await supabase.auth.signOut();
    redirect(`${catre}?eroare=invalida`);
  }

  // Contul există, e membru, invitația e consumată. Sesiunea se închide ca omul
  // să intre singur — vezi nota de sus.
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/autentificare?stare=cont-creat");
}

/**
 * Acceptarea pentru cine e DEJA autentificat — invitație într-o a doua firmă,
 * sau cineva care avea deja cont.
 */
export async function acceptaInvitatia(formData: FormData): Promise<void> {
  const token = tokenInvitatieSchema.safeParse(formData.get("token"));
  if (!token.success) redirect("/autentificare?eroare=link");
  const catre = `/invitatie/${token.data}`;

  const supabase = await createServerSupabase();
  const { data: sesiune } = await supabase.auth.getUser();
  if (!sesiune.user) redirect(`${catre}?eroare=sesiune`);

  const limita = await consumeRateLimit({
    key: `invitatie-accept:user:${sesiune.user.id}`,
    limit: 10,
    windowSeconds: 900,
  });
  if (!limita.allowed) redirect(`${catre}?eroare=limita`);

  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token.data });
  if (error) {
    // Singura distincție utilă pentru cineva care deține deja tokenul.
    const cod = /EMAIL/i.test(error.message) ? "alta-adresa" : "invalida";
    redirect(`${catre}?eroare=${cod}`);
  }

  /*
   * Până la migrarea 0091, funcția returna `uuid`, iar `safeParse` pe un obiect
   * pica ÎNTOTDEAUNA: ecranul spunea „Invitația nu mai este validă" DUPĂ ce
   * inserase rândul de membru, iar a doua încercare lovea „Ești deja membru" —
   * tradus în același mesaj. Contractul e reparat la sursă; verificarea rămâne.
   */
  const rezultat = rezultatAcceptare.safeParse(data);
  if (!rezultat.success) redirect(`${catre}?eroare=invalida`);

  (await cookies()).set(TENANT_COOKIE, signTenantCookie(rezultat.data.organization_id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
  redirect(RUTA_DUPA_AUTENTIFICARE);
}
