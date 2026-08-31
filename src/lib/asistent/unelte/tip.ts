// src/lib/asistent/unelte/tip.ts
/**
 * Forma unei unelte de date și, mai important, cele trei proprietăți de
 * siguranță pe care tipul ăsta le impune STRUCTURAL — nu prin disciplină.
 *
 * 1. `organizationId` nu apare NICIODATĂ printre parametrii pe care îi
 *    completează modelul. Vine din `ContextUnealta`, umplut din `resolveTenant()`
 *    în ruta API. Modelul nu poate cere date despre altă firmă fiindcă nu are
 *    unde să scrie altă firmă. E regula S1, deja scrisă în
 *    `api/export/audit/route.ts`: „organizația vine din tenant, nu din
 *    parametrii cererii”.
 *
 * 2. `permission` + `minScope` se verifică ÎNAINTE de `executa`, în dispecer.
 *    Un `employee` care întreabă „câți angajați avem” primește refuz de la
 *    stratul ăsta, nu de la judecata modelului. Judecata unui model e o
 *    preferință; o poartă e o poartă.
 *
 * 3. `executa` întoarce TEXT, nu rânduri. Unealta alege ce iese din bază.
 *    CNP-ul și IBAN-ul nu pot ajunge accidental în contextul modelului printr-un
 *    `select *` distrat, fiindcă nu există drum pe care să ajungă: tipul de
 *    întoarcere nu are loc pentru ele.
 *
 * Peste toate astea, fiecare unealtă citește cu `createServerSupabase()` —
 * clientul de sesiune, cu RLS activ. Nu `createAdminSupabase()`: ESLint l-ar
 * permite tehnic într-un `route.ts`, dar allow-list-ul aia presupune un motiv
 * scris, iar aici motivul ar fi „mi-a fost mai ușor”.
 */
import type { z } from "zod";

import type { FeatureKey } from "@/config/features";
import type { MinScope, PermissionKey } from "@/config/permissions";
import type { PermissionMap } from "@/lib/auth/permissions";
import type { AppRole } from "@/lib/tenant/types";

import type { Destinatie } from "../destinatii";

export type ContextUnealta = Readonly<{
  organizationId: string;
  memberId: string;
  role: AppRole;
  /** Fișa de angajat a celui care întreabă. `null` = cont fără fișă. */
  employeeId: string | null;
  numeUtilizator: string | null;
  permisiuni: PermissionMap;
  features: ReadonlySet<FeatureKey>;
  /** Ziua curentă la București, `AAAA-LL-ZZ`. */
  aziISO: string;
}>;

export type RezultatUnealta = Readonly<{
  /** Ce vede modelul. Proză scurtă, cifre exacte, fără rânduri brute. */
  text: string;
  /** Identificatori din indexul de destinații, sugerați modelului. */
  referinte?: readonly string[];
  /**
   * Destinații care există doar cât ține răspunsul ăsta — fișa unui om anume,
   * găsită de o căutare.
   *
   * Indexul static nu le poate conține: sunt tot atâtea câți angajați, iar
   * identificatorii lor nu există până nu întreabă cineva. Mulțimea rămâne
   * totuși închisă, doar că e închisă prin PROVENIENȚĂ: aici ajung numai
   * entitățile întoarse de o citire pe care omul chiar avea dreptul să o facă,
   * sub RLS, în chiar cererea asta. Vezi `OptiuniImpartire.extra` din
   * `marcaje.ts`.
   */
  destinatiiEfemere?: readonly Destinatie[];
}>;

export type Unealta = Readonly<{
  /** Numele pe care îl cheamă modelul. `sub_liniuță`, ca în restul lumii LLM. */
  nume: string;
  /** Descrierea o citește MODELUL, ca să decidă dacă are nevoie de unealtă. */
  descriere: string;
  parametri: z.ZodType;
  featureKey: FeatureKey | null;
  permission: PermissionKey | null;
  minScope: MinScope;
  /**
   * Unealta cere ca omul să aibă fișă de angajat.
   *
   * Un `org_admin` care e doar administrator, fără fișă, nu are sold de
   * concediu — și trebuie să afle asta ca răspuns, nu ca eroare.
   */
  cereFisaProprie?: boolean;
  executa: (context: ContextUnealta, argument: unknown) => Promise<RezultatUnealta>;
}>;
