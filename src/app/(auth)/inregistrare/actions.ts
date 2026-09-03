"use server";

import { businessRule } from "@/lib/actions/errors";
import { createPublicAction } from "@/lib/actions/public-action";
import { generateazaTokenInvitatie } from "@/lib/auth/token-invitatie";
import { trimiteEmailInvitatie } from "@/lib/email/invitations";
// Clientul de serviciu atinge AICI exclusiv `email_log`, după ce organizația a
// fost deja creată de funcția SECURITY DEFINER. Nicio dată trimisă de vizitator
// nu trece pe calea asta. Vezi nota „DOUĂ CĂI" de mai jos.
//
// ESLint permite importul în `actions.ts` prin lista albă din config, deci nu e
// nevoie de nicio directivă — una scrisă degeaba ar fi devenit ea însăși o
// avertizare.
import { createAdminSupabase } from "@/lib/supabase/admin";
import { ZILE_EXPIRARE_IMPLICIT } from "@/schemas/membership";

import { schemaInregistrare } from "./schema";

const ZI_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Înregistrare self-serve: o firmă își creează singură contul.
 *
 * ── DOUĂ CĂI, DELIBERAT DIFERITE ──────────────────────────────────────────
 * 1. CREAREA trece prin `public.inregistreaza_organizatie` (0121), funcție
 *    SECURITY DEFINER apelabilă de `anon`. Zero `service_role` pe drumul pe care
 *    circulă datele vizitatorului. E regula scrisă în `createPublicAction` și
 *    precedentul lui `submit_demo_request`.
 * 2. E-MAILUL folosește clientul de serviciu, fiindcă `email_log` are INSERT
 *    revocat pentru toată lumea în afară de `service_role` (0001). Momentul
 *    contează: se întâmplă DUPĂ ce baza a acceptat totul, iar singura valoare
 *    care ajunge acolo — adresa — e deja scrisă în rândul de invitație.
 *
 * ── CE VERIFICĂ ADRESA DE E-MAIL ──────────────────────────────────────────
 * Nimic din ce se creează aici nu dă acces. Organizația rămâne în `pending`, iar
 * singura cale înăuntru e tokenul care pleacă prin e-mail și e stocat doar ca
 * hash. Nu există pas separat de confirmare fiindcă nu e nevoie: cine nu
 * primește mesajul nu intră.
 *
 * ── DE CE EȘECUL E-MAILULUI NU ANULEAZĂ NIMIC ─────────────────────────────
 * Invitația e deja validă în bază. Dacă mesajul nu pleacă, aruncarea unei erori
 * ar spune vizitatorului că n-a mers, deși contul lui există — iar a doua
 * încercare ar cădea pe CUI duplicat. Ecranul spune că adresa e pe drum și, la
 * nevoie, se retrimite din consolă.
 */
export const inregistreazaFirma = createPublicAction({
  name: "inregistrare.firma",
  input: schemaInregistrare,
  // Mai strict decât cererea de demo (3/oră): acolo se scrie un rând, aici se
  // creează o organizație cu module active. Baza numără a doua oară, pe IP.
  rateLimit: { max: 3, windowSeconds: 3600 },
  handler: async (ctx, input) => {
    const { token, hash } = await generateazaTokenInvitatie();
    const expiraLa = new Date(ctx.now.getTime() + ZILE_EXPIRARE_IMPLICIT * ZI_IN_MS).toISOString();
    const telefon = input.telefon.length > 0 ? input.telefon : null;

    const { data, error } = await ctx.supabase.rpc("inregistreaza_organizatie", {
      p_firma: input.firma,
      p_cui: input.cui,
      p_nume: input.nume,
      p_prenume: input.prenume,
      p_email: input.email,
      p_token_hash: hash,
      p_expira_la: expiraLa,
      p_telefon: telefon,
    });

    if (error) {
      // PT409 și PT400 sunt codurile pe care funcția le ridică pentru situații
      // pe care vizitatorul le poate repara singur — CUI deja înregistrat, date
      // invalide. Mesajul lor e scris ca să fie citit, deci se transmite ca
      // atare. Orice altceva rămâne o eroare internă, cu id de referință.
      if (error.code === "PT409" || error.code === "PT400") {
        throw businessRule(error.message);
      }
      console.error("[inregistrare.firma] eroare la inregistreaza_organizatie", {
        requestId: ctx.requestId,
        code: error.code,
        message: error.message,
      });
      throw new Error("Nu am putut crea contul.");
    }

    /*
     * Funcția e declarată `returns jsonb`, deci tipurile generate dau `Json` —
     * o uniune, nu o formă. Conversia e inevitabilă; ce nu e inevitabil e s-o
     * crezi pe cuvânt. Verificarea de mai jos costă două comparații și
     * transformă o citire de `undefined` trei rânduri mai jos într-o eroare cu
     * id de referință.
     */
    const rezultat = data as { organization_id?: unknown; invitation_id?: unknown } | null;
    if (
      rezultat === null ||
      typeof rezultat.organization_id !== "string" ||
      typeof rezultat.invitation_id !== "string"
    ) {
      console.error("[inregistrare.firma] răspuns neașteptat de la bază", {
        requestId: ctx.requestId,
      });
      throw new Error("Nu am putut crea contul.");
    }
    const organizationId = rezultat.organization_id;
    const invitationId = rezultat.invitation_id;

    let prinEmail = false;
    try {
      const email = await trimiteEmailInvitatie({
        db: createAdminSupabase(),
        destinatar: input.email,
        organizatie: input.firma,
        invitatDe: "Administrativo",
        rol: "org_admin",
        token,
        expiraLa,
        invitationId,
      });
      prinEmail = email.ok;
      if (!email.ok) {
        // `SendEmailResult` la eșec poartă `motiv` + `message`, nu `error` —
        // motivul e enumerarea („adresa_invalida", „provider", „config_lipsa",
        // „baza_de_date"), iar mesajul e textul pentru jurnal.
        console.error("[inregistrare.firma] invitația nu a plecat", {
          requestId: ctx.requestId,
          organizationId,
          motiv: email.motiv,
          mesaj: email.message,
        });
      }
    } catch (eroare: unknown) {
      console.error("[inregistrare.firma] expedierea a aruncat", {
        requestId: ctx.requestId,
        organizationId,
        eroare,
      });
    }

    // Linkul NU se întoarce clientului, spre deosebire de fluxul din consolă:
    // acolo îl vede un administrator de platformă care are oricum acces la tot,
    // aici l-ar vedea oricine completează formularul cu adresa altcuiva.
    return { email: input.email, prinEmail } as const;
  },
});
