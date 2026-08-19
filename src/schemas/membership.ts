// src/schemas/membership.ts
import { z } from "zod";

/** Toate rolurile din enum-ul `app_role`. */
export const ROLURI_APLICATIE = ["super_admin", "org_admin", "manager", "hr", "employee"] as const;
export type RolAplicatie = (typeof ROLURI_APLICATIE)[number];

/**
 * Rolurile care pot fi atribuite unui membru al unei organizații.
 * `super_admin` lipsește intenționat: există un CHECK în `organization_members`
 * care îl refuză, deci nu îl oferim niciodată în interfață.
 */
export const ROLURI_ATRIBUIBILE = ["org_admin", "manager", "hr", "employee"] as const;
export type RolAtribuibil = (typeof ROLURI_ATRIBUIBILE)[number];

export const ETICHETE_ROL: Readonly<Record<RolAplicatie, string>> = {
  super_admin: "Super administrator",
  org_admin: "Administrator organizație",
  manager: "Manager",
  hr: "Resurse umane",
  employee: "Angajat",
};

export const DESCRIERI_ROL: Readonly<Record<RolAtribuibil, string>> = {
  org_admin: "Administrează organizația, membrii și setările acesteia.",
  manager: "Coordonează echipa și aprobă cererile subordonaților.",
  hr: "Gestionează dosarele de personal și procesele de resurse umane.",
  employee: "Acces la propriile date și la cererile personale.",
};

export const ETICHETE_STATUS_MEMBRU: Readonly<Record<"active" | "suspended" | "inactive", string>> =
  {
    active: "Activ",
    suspended: "Suspendat",
    inactive: "Inactiv",
  };

export const ETICHETE_STATUS_INVITATIE: Readonly<
  Record<"pending" | "accepted" | "expired" | "revoked", string>
> = {
  pending: "În așteptare",
  accepted: "Acceptată",
  expired: "Expirată",
  revoked: "Revocată",
};

export const ZILE_EXPIRARE_IMPLICIT = 7;
export const ZILE_EXPIRARE_MIN = 1;
export const ZILE_EXPIRARE_MAX = 30;

const identificator = z.uuid({ error: "Identificatorul trimis nu este valid." });

/**
 * `organizationId` NU este o alegere a clientului: vine din segmentul de rută
 * `[orgId]` al panoului de super-admin și este verificat server-side
 * (`requirePlatformAdmin` + existența organizației). Autoritatea stă în
 * verificare, nu în valoarea trimisă.
 */
const numeOptional = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : v));

export const schemaInvitatie = z.object({
  organizationId: identificator,
  email: z
    .email({ error: "Introdu o adresă de e-mail validă." })
    .max(254, { error: "Adresa de e-mail este prea lungă." }),
  role: z.enum(ROLURI_ATRIBUIBILE, { error: "Alege un rol din listă." }),
  expiraInZile: z
    .number({ error: "Introdu numărul de zile până la expirare." })
    .int({ error: "Numărul de zile trebuie să fie un număr întreg." })
    .min(ZILE_EXPIRARE_MIN, {
      error: `Invitația trebuie să fie valabilă cel puțin ${ZILE_EXPIRARE_MIN} zi.`,
    })
    .max(ZILE_EXPIRARE_MAX, {
      error: `Invitația poate fi valabilă cel mult ${ZILE_EXPIRARE_MAX} de zile.`,
    }),
  /** Capturate opțional la înrolarea companiei, ca să precompleteze profilul la acceptare. */
  nume: numeOptional,
  prenume: numeOptional,
  telefon: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : v)),
});
/**
 * Tipul de INTRARE, nu de ieșire: `nume`/`prenume`/`telefon` devin opționale
 * doar după transform, iar `useForm` + `zodResolver` trebuie tipate pe forma pe
 * care o completează utilizatorul, nu pe cea rezultată după validare.
 */
export type DateInvitatie = z.input<typeof schemaInvitatie>;

export const schemaSchimbareRol = z.object({
  organizationId: identificator,
  memberId: identificator,
  role: z.enum(ROLURI_ATRIBUIBILE, { error: "Alege un rol din listă." }),
});
export type DateSchimbareRol = z.infer<typeof schemaSchimbareRol>;

export const schemaActiuneMembru = z.object({
  organizationId: identificator,
  memberId: identificator,
});

export const schemaActiuneInvitatie = z.object({
  organizationId: identificator,
  invitationId: identificator,
});

export function esteRolAtribuibil(valoare: string): valoare is RolAtribuibil {
  return (ROLURI_ATRIBUIBILE as readonly string[]).includes(valoare);
}
