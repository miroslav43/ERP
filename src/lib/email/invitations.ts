import "server-only";

import type { AppRole } from "@/lib/tenant/types";

import { sendEmail, type EmailDb, type SendEmailResult } from "./send";

/**
 * Emailul de invitație, într-un singur loc.
 *
 * Există două puncte din care se invită cineva — panoul de platformă și setările
 * organizației — iar ambele trebuie să producă exact același email. Un wrapper
 * subțire e justificat tocmai ca să nu diverge conținutul între ele.
 *
 * Tokenul se transmite în CLAR aici, fiindcă doar destinatarul trebuie să îl
 * primească; în baza de date stă exclusiv `sha256(token)`. Linkul îl compune
 * șablonul, din `NEXT_PUBLIC_APP_URL` — nu îl construiește apelantul, altfel
 * fiecare loc de apel ar putea produce alt domeniu.
 */

const ETICHETE_ROL: Readonly<Record<AppRole, string>> = {
  super_admin: "Administrator de platformă",
  org_admin: "Administrator",
  manager: "Manager",
  hr: "Resurse umane",
  employee: "Angajat",
};

export type TrimiteInvitatieInput = Readonly<{
  db: EmailDb;
  /** Adresa invitată. */
  destinatar: string;
  /** Denumirea organizației, așa cum o vede destinatarul. */
  organizatie: string;
  /** Cine a trimis invitația — apare în email ca să nu pară nesolicitat. */
  invitatDe: string;
  rol: AppRole;
  /** Tokenul în clar. În baza de date stă doar hash-ul lui. */
  token: string;
  /** ISO. Șablonul îl formatează în ora României. */
  expiraLa: string;
  /** Id-ul invitației, pentru idempotență și pentru urmărirea în `email_log`. */
  invitationId: string;
}>;

export async function trimiteEmailInvitatie(
  input: TrimiteInvitatieInput,
): Promise<SendEmailResult> {
  return sendEmail({
    db: input.db,
    to: input.destinatar,
    entityId: input.invitationId,
    template: "invitatie",
    data: {
      organizatie: input.organizatie,
      invitatDe: input.invitatDe,
      rolEticheta: ETICHETE_ROL[input.rol],
      token: input.token,
      expiraLa: input.expiraLa,
    },
  });
}
