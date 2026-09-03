import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";

/**
 * Tokenul unei invitații, generat într-un singur loc.
 *
 * ── DE CE ARE MODUL PROPRIU ───────────────────────────────────────────────
 * Funcția trăia privată în `super-admin/organizatii/[orgId]/membri/actions.ts`.
 * Odată cu înregistrarea self-serve, al doilea apelant ar fi însemnat a doua
 * copie a unui generator de secrete — exact felul de duplicare în care una
 * dintre copii primește cândva o îmbunătățire, iar cealaltă nu.
 *
 * ── ÎMPĂRȚIREA CARE CONTEAZĂ ──────────────────────────────────────────────
 * În bază se scrie DOAR amprenta sha256. Valoarea în clar există într-un singur
 * exemplar, în linkul întors, și pleacă prin e-mail. Consecința practică: un
 * backup, un jurnal de interogări sau o citire nedorită din `invitations` nu dau
 * pe nimeni înăuntru. Consecința a doua, la fel de importantă: un token pierdut
 * nu se poate recupera, se retrimite altul.
 *
 * 32 de octeți din `randomBytes` — generatorul criptografic al sistemului, nu
 * `Math.random()`. În base64url ies 43 de caractere sigure în URL.
 */
export type TokenInvitatie = Readonly<{
  /** Valoarea în clar. Pleacă prin e-mail și nu se stochează. */
  token: string;
  /** sha256, hex. Singurul lucru care ajunge în `invitations.token_hash`. */
  hash: string;
  /** Linkul complet de acceptare. */
  link: string;
}>;

/**
 * Adresa de bază a aplicației.
 *
 * `NEXT_PUBLIC_APP_URL` are prioritate fiindcă e valoarea validată la pornire și
 * e aceeași pentru toate mesajele. Antetele cererii rămân doar ca rezervă: un
 * link de invitație compus din `Host` ar urma domeniul de pe care s-a nimerit
 * apelul, iar o cerere venită prin alt vhost ar trimite omul pe alt sit.
 */
async function bazaAplicatiei(): Promise<string> {
  const configurat = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configurat) return configurat.replace(/\/+$/, "");
  const antete = await headers();
  const gazda = antete.get("host") ?? "localhost:3000";
  const protocol =
    antete.get("x-forwarded-proto") ?? (gazda.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${gazda}`;
}

export async function generateazaTokenInvitatie(): Promise<TokenInvitatie> {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  const baza = await bazaAplicatiei();
  return { token, hash, link: `${baza}/invitatie/${token}` };
}
