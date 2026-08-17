import "server-only";

import { createAdminSupabase } from "@/lib/supabase/admin";

/**
 * Limitare de rată persistentă, în Postgres.
 *
 * Nu în memorie: pe un runtime serverless rulează N instanțe simultan, fiecare
 * cu propriul contor, deci un atacator obține de N ori limita. Contorul trebuie
 * să fie partajat, iar baza de date este singurul loc partajat pe care îl avem.
 *
 * Apelul pleacă prin clientul admin, deliberat. Funcția `consume_rate_limit`
 * este expusă exclusiv lui `service_role`: dacă `anon` ar putea-o apela direct,
 * oricine ar epuiza cota altcuiva trimițând de câteva ori
 * `login:cont:victima@exemplu.ro` și ar bloca acel cont din exterior. Cheia se
 * compune aici, pe server, din IP-ul real și din datele cererii.
 */

export type RateLimitInput = Readonly<{
  /** Cheia contorului, ex. `login:ip:1.2.3.4` sau `login:cont:ana@exemplu.ro`. */
  key: string;
  /** Câte cereri sunt permise în fereastră. */
  limit: number;
  /** Lungimea ferestrei, în secunde. */
  windowSeconds: number;
}>;

export type RateLimitResult = Readonly<{
  /** `false` înseamnă că limita a fost atinsă și cererea trebuie refuzată. */
  allowed: boolean;
}>;

export async function consumeRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const { key, limit, windowSeconds } = input;

  if (key.length === 0 || limit < 1 || windowSeconds < 1) {
    throw new Error("Parametri invalizi pentru limitarea de rată.");
  }

  const supabase = createAdminSupabase();
  const { data, error } = await supabase.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    // Eșecul contorului nu are voie să blocheze autentificarea întregii
    // aplicații: dacă baza nu răspunde, refuzul de serviciu ar fi total.
    // Lăsăm cererea să treacă și lăsăm o urmă în log pentru investigație.
    console.error("[rate-limit] contorul nu a putut fi actualizat", { key, error });
    return { allowed: true };
  }

  return { allowed: data === true };
}
