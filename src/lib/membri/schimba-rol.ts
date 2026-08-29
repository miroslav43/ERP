// src/lib/membri/schimba-rol.ts
// Schimbarea rolului unei apartenențe: cele două piedici, scrierea, verificarea.
//
// ── DE CE UN MODUL, ȘI NU UN APEL ÎNTRE ACȚIUNI ────────────────────────────
// Aceeași scriere e nevoie acum din trei locuri: ecranul de membri, pagina de
// permisiuni a angajatului și regula automată de la desemnarea unui șef de
// departament. `schimbaRolulMembrului` e construit cu `createAction`, care nu
// întoarce o funcție obișnuită, ci un handler cu opt straturi proprii — chemat
// din altă acțiune, ar rula a doua oară tot lanțul, cu altă permisiune cerută și
// cu un al doilea rând de audit pentru aceeași apăsare de buton.
//
// Precedentul e `@/lib/invitatii/creeaza`, extras din exact același motiv.
//
// ── POARTA REALĂ NU E AICI ─────────────────────────────────────────────────
// `organization_members_update` (0002_authz.sql:959) cere
// `app.has_role(org, ['org_admin'])` — ROL, nu permisiune — și interzice
// `super_admin` ca valoare. Piedicile de mai jos sunt reguli de business peste
// gard, nu gardul: ele apără firma de a rămâne fără administrator, nu baza de
// un apelant neîndreptățit.
import { businessRule, notFound } from "@/lib/actions/errors";
import type { ServerSupabase } from "@/lib/supabase/server";

/** Rolurile care se pot atribui din aplicație. `super_admin` nu e unul dintre ele. */
export type RolAtribuibil = "org_admin" | "manager" | "hr" | "employee";

export const ROLURI_ATRIBUIBILE = ["org_admin", "manager", "hr", "employee"] as const;

/**
 * Câți administratori activi rămân în firmă dacă cel indicat n-ar mai fi unul.
 *
 * Se numără de fiecare dată, nu se citește dintr-o stare adusă de client: între
 * randarea ecranului și apăsarea butonului, alt administrator poate fi
 * dezactivat de altcineva.
 */
export async function numaraAdminiActivi(
  db: ServerSupabase,
  organizationId: string,
  exceptaMembrul: string,
): Promise<number> {
  const { count } = await db
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "org_admin")
    .eq("status", "active")
    .neq("id", exceptaMembrul);
  return count ?? 0;
}

export type ParametriSchimbareRol = Readonly<{
  db: ServerSupabase;
  organizationId: string;
  /** Apartenența care primește rolul — `organization_members.id`, nu fișa. */
  memberId: string;
  rol: RolAtribuibil;
  /**
   * Apartenența celui care face schimbarea. Comparată cu ținta: nimeni nu-și
   * schimbă singur rolul, altfel un administrator s-ar putea închide pe dinafară
   * fără ca nimeni să-i mai poată deschide.
   */
  memberIdAutor: string | null;
  /**
   * Ce s-a scris DEJA, când schimbarea e a doua scriere dintr-o acțiune.
   *
   * PostgREST nu deschide o tranzacție peste două cereri: la desemnarea unui șef
   * de departament, departamentul e salvat înainte ca rolul să se schimbe.
   * „A eșuat" ar fi o minciună despre rândul deja scris, deci mesajul o spune.
   */
  ceEsteDejaScris?: string;
}>;

export async function schimbaRolul(
  parametri: ParametriSchimbareRol,
): Promise<Readonly<{ id: string; role: string }>> {
  const { db, organizationId, memberId, rol, memberIdAutor, ceEsteDejaScris } = parametri;

  if (memberIdAutor !== null && memberId === memberIdAutor) {
    throw businessRule("Nu vă puteți schimba propriul rol. Rugați alt administrator.");
  }
  if (rol !== "org_admin" && (await numaraAdminiActivi(db, organizationId, memberId)) === 0) {
    throw businessRule("Organizația trebuie să aibă cel puțin un administrator activ.");
  }

  const { data, error } = await db
    .from("organization_members")
    .update({ role: rol })
    .eq("id", memberId)
    .eq("organization_id", organizationId)
    .select("id, role")
    // `.select()` după `.update()`: un UPDATE respins de clauza `USING` afectează
    // zero rânduri și NU dă eroare. Fără el, refuzul ar fi raportat ca reușită.
    .maybeSingle();

  if (error !== null) throw error;
  if (data === null) {
    throw notFound(
      ceEsteDejaScris === undefined
        ? "Membrul nu a fost găsit în această organizație."
        : `${ceEsteDejaScris}, dar rolul nu a putut fi schimbat: apartenența nu mai există sau nu aveți dreptul de a o modifica. Schimbați rolul din Setări → Membri.`,
    );
  }
  return { id: data.id, role: data.role };
}
