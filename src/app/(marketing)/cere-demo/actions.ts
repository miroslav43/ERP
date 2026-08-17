// src/app/(marketing)/cere-demo/actions.ts
"use server";

import { businessRule } from "@/lib/actions/errors";
import { createPublicAction } from "@/lib/actions/public-action";
import { schemaCereDemo } from "./schema";

/**
 * Calea publică NU folosește service_role (S4): trimiterea se face prin funcția
 * SECURITY DEFINER `submit_demo_request`, expusă rolului anon.
 * Rate limit persistent pe IP (S5) — mesajul de refuz este identic indiferent
 * dacă adresa a mai trimis sau nu o cerere.
 *
 * Auditul (`demo_requested`, entitate `demo_requests`) NU se scrie de aici:
 * `log_audit_event` are GRANT doar către `authenticated` și `service_role`, iar
 * calea publică rulează pe clientul `anon`. Rândul îl scrie chiar
 * `submit_demo_request`, prin `app.write_audit`, în aceeași tranzacție cu
 * inserarea — deci și cu id-ul real al cererii.
 */
export const trimiteCerereDemo = createPublicAction({
  name: "demo.request",
  input: schemaCereDemo,
  rateLimit: { max: 3, windowSeconds: 3600 },
  handler: async (ctx, input) => {
    const telefon = input.telefon.length > 0 ? input.telefon : null;
    const mesaj = input.mesaj.length > 0 ? input.mesaj : null;

    const { error } = await ctx.supabase.rpc("submit_demo_request", {
      p_nume: input.nume,
      p_firma: input.firma,
      p_email: input.email,
      p_telefon: telefon,
      p_nr_angajati: input.nrAngajati,
      p_mesaj: mesaj,
    });

    if (error) {
      // UNIQUE(email, created_day): a doua cerere din aceeași zi, de pe același e-mail.
      if (error.code === "23505") {
        throw businessRule(
          "Am primit deja astăzi o cerere de la această adresă de e-mail. Îți răspundem în cel mult o zi lucrătoare.",
        );
      }
      console.error("[demo.request] eroare la submit_demo_request", {
        requestId: ctx.requestId,
        code: error.code,
        message: error.message,
      });
      throw new Error("Nu am putut înregistra cererea.");
    }

    return { trimis: true } as const;
  },
});
