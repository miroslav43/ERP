// src/lib/invitatii/creeaza.ts
// Crearea unei invitații: locuri, duplicate, token, rând, e-mail.
//
// ── DE CE UN MODUL, ȘI NU UN APEL ÎNTRE ACȚIUNI ────────────────────────────
// `invitaMembru` e construit cu `createAction`, care nu întoarce o funcție
// obișnuită, ci un handler cu opt straturi proprii — autentificare, tenant,
// modul, permisiune, validare, audit, revalidare. Chemat din `inroleazaAngajat`,
// ar rula a doua oară TOT lanțul, cu ALTĂ permisiune cerută (`users:create`) și
// cu al doilea rând de audit pentru aceeași apăsare de buton.
//
// Aici stă doar munca: cele două verificări de business, tokenul, INSERT-ul și
// e-mailul. Cine o cheamă își aduce propriul context și propria permisiune —
// `users:create` din ecranul de membri, `employees:invite` de la înrolare.
import { createHash, randomBytes } from "node:crypto";

import { businessRule, limitExceeded, notFound } from "@/lib/actions/errors";
import { trimiteEmailInvitatie } from "@/lib/email/invitations";
import type { ServerSupabase } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/utils/rate-limit";

import { potrivesteInvitatia } from "./potrivire";

/** Șapte zile: destul cât să prindă un concediu scurt, nu cât să fie uitat. */
export const ZILE_VALABILITATE = 7;

export type RolInvitabil = "org_admin" | "manager" | "hr" | "employee";

export type ParametriInvitatie = Readonly<{
  db: ServerSupabase;
  organizationId: string;
  email: string;
  rol: RolInvitabil;
  /** Fișa de personal pe care o va prelua contul. NULL = invitație de membru pur. */
  employeeId?: string | null;
  /** Cine invită — apare în e-mail. */
  invitatDe: string;
  /**
   * Ce se face când adresa — sau fișa — are deja o invitație în așteptare.
   *
   * `false`, implicit: se refuză, ca până acum. Ecranul de membri ține lista
   * invitațiilor sub ochi, cu retrimitere și revocare pe fiecare rând; acolo un
   * al doilea „Invită" pe aceeași adresă e o greșeală de operare, iar refuzul o
   * spune.
   *
   * `true`: se RETRIMITE — token nou, termen nou, adresa de acum din fișă.
   * Butonul de pe fișa angajatului n-are nicio listă sub el și e singurul drum
   * al omului care n-a primit e-mailul: ajuns în spam, adresă greșită la
   * înrolare, link expirat. Acolo, „există deja" nu era un răspuns.
   */
  retrimiteDacaExista?: boolean;
  /**
   * `false` pentru adresele SINTETICE (`marca-0042@firma.intern`, vezi
   * `adresa.ts`): domeniul e rezervat prin RFC 8375 și n-are server. Un mesaj
   * trimis acolo nu eșuează util — se întoarce ca bounce, murdărește reputația
   * domeniului expeditor și umple `email_log` cu eșecuri care par defecte.
   * Invitația rămâne perfect validă; ajunge la om pe hârtie.
   */
  trimiteEmail?: boolean;
  userId: string;
  acum: Date;
}>;

export type InvitatieCreata = Readonly<{
  id: string;
  email: string;
  /** Tokenul în clar, întors o singură dată: linkul se compune din el. */
  token: string;
  emailTrimis: boolean;
  /**
   * `true` dacă a fost reînnoită o invitație existentă, nu creată una nouă.
   *
   * Interfața are ce spune diferit: linkul trimis înainte tocmai a devenit
   * inutilizabil, iar cine tipărise fișa veche trebuie s-o tipărească din nou.
   */
  retrimisa: boolean;
}>;

export async function creeazaInvitatie(parametri: ParametriInvitatie): Promise<InvitatieCreata> {
  const { db, organizationId } = parametri;

  const limita = await consumeRateLimit({
    key: `invite:${organizationId}`,
    limit: 20,
    windowSeconds: 3600,
  });
  if (!limita.allowed) {
    throw limitExceeded("S-au trimis prea multe invitații în ultima oră. Reîncercați mai târziu.");
  }

  const email = parametri.email.trim().toLowerCase();

  const [{ count: membriActivi }, { data: invitatiiPendinte }, { data: organizatie }] =
    await Promise.all([
      db
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("status", "active"),
      db
        .from("invitations")
        // `employee_id` (0099) intră în select ca să se poată recunoaște
        // invitația ACELEIAȘI fișe emisă pe ALTĂ adresă — vezi mai jos.
        .select("id, email, employee_id")
        .eq("organization_id", organizationId)
        .eq("status", "pending"),
      db.from("organizations").select("seats_limit, name").eq("id", organizationId).maybeSingle(),
    ]);

  if (organizatie === null) throw notFound("Organizația nu a fost găsită.");

  const pendinte = invitatiiPendinte ?? [];
  const employeeId = parametri.employeeId ?? null;

  // Care invitație în așteptare e „aceeași" — și care doar SEAMĂNĂ. Decizia e
  // pură și are propriile teste: `potrivire.ts`. Aici rămâne doar ce se face cu
  // verdictul.
  const potrivire = potrivesteInvitatia(pendinte, email, employeeId);

  if (potrivire.fel !== "creeaza" && parametri.retrimiteDacaExista !== true) {
    throw businessRule("Există deja o invitație în așteptare pentru această adresă.");
  }
  if (potrivire.fel === "coliziune") {
    throw businessRule(
      `Adresa ${potrivire.adresa} este deja folosită de invitația în așteptare a altui angajat. Revocați-o mai întâi, din Setări → Membri.`,
    );
  }
  // Locul e verificat doar pentru o invitație NOUĂ: cea retrimisă e deja
  // numărată în `pendinte`, iar refuzul ar fi lovit exact firma ajunsă la
  // plafon, adică pe cea care nu mai poate nici măcar retrimite.
  if (
    potrivire.fel === "creeaza" &&
    (membriActivi ?? 0) + pendinte.length >= organizatie.seats_limit
  ) {
    throw limitExceeded(
      `Ați atins limita de ${String(organizatie.seats_limit)} locuri. Dezactivați un membru sau extindeți contractul.`,
    );
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expira = new Date(parametri.acum.getTime() + ZILE_VALABILITATE * 24 * 60 * 60 * 1000);

  const data = await (potrivire.fel === "creeaza"
    ? scrieInvitatieNoua(db, {
        organizationId,
        email,
        rol: parametri.rol,
        tokenHash,
        expira,
        userId: parametri.userId,
        employeeId,
      })
    : retrimiteInvitatia(db, {
        invitationId: potrivire.id,
        organizationId,
        email,
        tokenHash,
        expira,
        userId: parametri.userId,
        employeeId,
      }));

  // Linkul îl compune șablonul, din `NEXT_PUBLIC_APP_URL` validat la boot.
  // Construit aici, fiecare loc de apel ar putea produce alt domeniu, iar
  // `process.env` citit direct ar ocoli validarea din `config/env.ts`.
  const retrimisa = potrivire.fel === "retrimite";
  let emailTrimis = false;
  if (parametri.trimiteEmail === false) {
    return { id: data.id, email: data.email, token, emailTrimis: false, retrimisa };
  }
  try {
    await trimiteEmailInvitatie({
      db,
      destinatar: email,
      organizatie: organizatie.name,
      invitatDe: parametri.invitatDe,
      rol: parametri.rol,
      token,
      expiraLa: expira.toISOString(),
      invitationId: data.id,
    });
    emailTrimis = true;
  } catch (eroare) {
    // Invitația rămâne validă chiar dacă e-mailul eșuează; linkul se poate copia
    // manual din ecranul de membri.
    console.error("[email] Invitația nu a putut fi trimisă", {
      invitationId: data.id,
      mesaj: eroare instanceof Error ? eroare.message : "necunoscut",
    });
  }

  return { id: data.id, email: data.email, token, emailTrimis, retrimisa };
}

type RandInvitatie = Readonly<{ id: string; email: string }>;

async function scrieInvitatieNoua(
  db: ServerSupabase,
  p: Readonly<{
    organizationId: string;
    email: string;
    rol: RolInvitabil;
    tokenHash: string;
    expira: Date;
    userId: string;
    employeeId: string | null;
  }>,
): Promise<RandInvitatie> {
  const { data, error } = await db
    .from("invitations")
    .insert({
      organization_id: p.organizationId,
      email: p.email,
      role: p.rol,
      token_hash: p.tokenHash,
      expires_at: p.expira.toISOString(),
      status: "pending",
      invited_by: p.userId,
      // Legătura cu fișa (0099). La acceptare, triggerul
      // `internal.membru_creeaza_fisa_de_angajat` scrie `employees.user_id`.
      employee_id: p.employeeId,
    })
    .select("id, email")
    .single();

  if (error !== null) throw error;
  return data;
}

/**
 * Retrimiterea: același rând, alt token.
 *
 * ── CE TREBUIE SĂ ȘTIE CINE CITEȘTE ASTA ───────────────────────────────────
 * Tokenul în clar nu se poate reciti din bază — acolo stă doar SHA-256-ul lui.
 * Deci „retrimite același link" nu există ca operație; retrimiterea ÎNSEAMNĂ un
 * token nou, iar cel vechi moare pe loc. E și comportamentul consolei de
 * platformă, și motivul pentru care interfața trebuie s-o spună.
 *
 * ── DE CE `.select()` DUPĂ UPDATE, ȘI DE CE `maybeSingle` ───────────────────
 * Până la 0105, un UPDATE pe `invitations` venit de la un `hr` atingea zero
 * rânduri FĂRĂ EROARE (politica cerea `users:update = all`, pe care `hr` nu-l
 * are), iar triggerul `internal.guard_invitations` repunea oricum `token_hash`
 * pe valoarea veche. Ambele straturi tăceau. Rândul zero e singurul semn, deci
 * se citește și se tratează drept refuz — nu ca „a mers".
 *
 * `role` NU se trimite: gardianul îl îngheață oricum la reînnoire, iar o
 * invitație de `org_admin` retrimisă din fișa angajatului n-are voie să se
 * retrogradeze tăcut la `employee`.
 */
async function retrimiteInvitatia(
  db: ServerSupabase,
  p: Readonly<{
    invitationId: string;
    organizationId: string;
    email: string;
    tokenHash: string;
    expira: Date;
    userId: string;
    employeeId: string | null;
  }>,
): Promise<RandInvitatie> {
  const faraDrept = businessRule(
    "Există deja o invitație în așteptare pentru acest angajat, dar nu aveți dreptul de a o retrimite. Cereți-i unui administrator să o retrimită sau să o revoce.",
  );

  const { data, error } = await db
    .from("invitations")
    .update({
      email: p.email,
      token_hash: p.tokenHash,
      expires_at: p.expira.toISOString(),
      invited_by: p.userId,
      // Fișa se leagă acum, dacă invitația era de membru pur; nu se dezleagă
      // niciodată — de aceea câmpul lipsește cu totul când n-avem fișă.
      ...(p.employeeId === null ? {} : { employee_id: p.employeeId }),
    })
    .eq("id", p.invitationId)
    .eq("organization_id", p.organizationId)
    .eq("status", "pending")
    .select("id, email")
    .maybeSingle();

  // 42501 = clauza `with check` a politicii. Vine, de exemplu, când cineva cu
  // `employees:invite` nimerește o invitație de alt rol decât `employee`.
  if (error !== null) {
    if (error.code === "42501") throw faraDrept;
    throw error;
  }
  if (data === null) throw faraDrept;
  return data;
}
