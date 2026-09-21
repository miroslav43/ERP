// src/app/(marketing)/cere-demo/actions.ts
"use server";

import { businessRule } from "@/lib/actions/errors";
import { createPublicAction } from "@/lib/actions/public-action";
// `submit_demo_request` nu mai e expusă rolului `anon` (0145): funcția scrie un
// rând pornind de la date nevalidate de nimeni altcineva, iar limitarea ei de
// rată din bază se uita la IP-ul SERVERULUI nostru, nu al vizitatorului. Acum e
// apelabilă doar cu `service_role`, iar singura poartă e limitarea de mai jos,
// pe IP-ul verificat din antetele cererii. ESLint permite importul în
// `actions.ts` prin lista albă din config.
import { createAdminSupabase } from "@/lib/supabase/admin";

import { schemaCereDemo } from "./schema";

/**
 * Calea publică trece prin funcția SECURITY DEFINER `submit_demo_request`, care
 * validează ea însăși datele și scrie rândul de audit în aceeași tranzacție.
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

    const { error } = await createAdminSupabase().rpc("submit_demo_request", {
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
