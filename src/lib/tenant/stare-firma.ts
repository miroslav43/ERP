import "server-only";

import { cache } from "react";

import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Starea de configurare a firmei, pentru poarta din layout-ul aplicației.
 *
 * `pending` înseamnă „datele firmei nu sunt complete". Organizațiile se creează
 * deja cu starea asta (`organizatii/nou/actions.ts`), iar până acum nu bloca
 * nimic — era pur informativă. Odată cu înrolarea partajată, ea decide dacă
 * administratorul e trimis în asistent.
 *
 * Interogare separată, memoizată, în loc de un câmp nou pe `Tenant`: tipul
 * `Tenant` e folosit în zeci de locuri și e atins în paralel de altă muncă;
 * o coloană în plus acolo ar fi un conflict garantat pentru un singur consumator.
 *
 * Capcană `React.cache()`: memoizarea compară argumentele prin identitate, deci
 * semnătura primește exclusiv primitive — cu un obiect, fiecare apel ar fi un miss.
 */
export const stareFirmei = cache(async (organizationId: string): Promise<string | null> => {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("organizations")
    .select("status")
    .eq("id", organizationId)
    .maybeSingle();

  if (error !== null) {
    // Fail OPEN, deliberat: la o eroare de citire nu blocăm accesul în aplicație.
    // Poarta asta e de confort — ghidează administratorul spre asistent — nu e
    // barieră de securitate. Aceea rămâne RLS. A eșua închis ar transforma o
    // sughițare de rețea într-o aplicație inaccesibilă pentru toată lumea.
    console.error("[tenant] nu s-a putut citi starea organizației", {
      organizationId,
      code: error.code,
    });
    return null;
  }

  return data?.status ?? null;
});
