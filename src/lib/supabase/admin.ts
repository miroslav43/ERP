// src/lib/supabase/admin.ts
import "server-only";

import { createClient } from "@supabase/supabase-js";

import { clientEnv, serverEnv } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * ⚠️ CLIENT CU `service_role`. OCOLEȘTE COMPLET RLS ȘI TOATE POLITICILE.
 *
 * Ce înseamnă concret: `.from("employees").select("*")` întoarce angajații
 * TUTUROR firmelor-client. Nu există plasă de siguranță sub acest client —
 * filtrul pe `organization_id` trebuie scris de mână, la FIECARE interogare.
 *
 * PERMIS doar în:
 *   - `app/(platform)/super-admin/**` — crearea organizațiilor și a primului
 *     org_admin, adică exact operațiunile pe care nicio politică nu le poate
 *     acorda (nu există încă apartenență de la care să pornească RLS);
 *   - Route Handlers de sistem (webhook Resend) și scripturi/cron din `scripts/`;
 *   - migrări de date punctuale.
 *
 * INTERZIS: componente, layout-uri, `lib/queries/**`, orice cale pe care ajunge
 * un request de utilizator obișnuit. ESLint (`no-restricted-imports`) blochează
 * importul peste tot minus `actions.ts`, `api/**\/route.ts`, `scripts/**`,
 * `tests/**`; `import "server-only"` sparge build-ul dacă fișierul ajunge
 * într-un bundle de client. Cele două bariere sunt cumulative, nu alternative.
 *
 * OBLIGATORIU la fiecare utilizare: un comentariu care explică de ce RLS nu
 * poate face treaba, filtru explicit pe `organization_id` și o intrare în
 * `audit_logs` cu `actor_id` real (nu null) — altfel operațiunea devine
 * netrasabilă, ceea ce pentru un ERP multi-tenant e la fel de grav ca scurgerea.
 */
export type AdminSupabase = ReturnType<typeof createClient<Database>>;

export function createAdminSupabase(): AdminSupabase {
  // Centură peste bretele: `server-only` prinde cazul la build, asta îl prinde
  // și dacă bundler-ul e configurat greșit.
  if (typeof window !== "undefined") {
    throw new Error("Clientul service_role nu are ce căuta în browser.");
  }

  return createClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    {
      // Fără persistarea sesiunii: clientul nu are „utilizator”, iar un token
      // scris pe disc într-un runtime serverless partajat e o scurgere de cheie.
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: { headers: { "x-application-name": "administrativo-admin" } },
    },
  );
}
