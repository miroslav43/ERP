// src/lib/push/jeton.ts
import { z } from "zod";

/**
 * Aceeași formă ca `check` de pe `dispozitive_push.jeton` (0122). Dublarea e
 * deliberată: baza e bariera adevărată, dar un refuz de la ea ajunge la om ca
 * eroare de constrângere, nu ca mesaj. Aici se oprește devreme și cu explicație.
 *
 * Forma verificată aici e exact ce întoarce `Notifications.getExpoPushTokenAsync()`
 * din `expo-notifications` (SDK 57, instalat în `mobil/`) în câmpul `.data` —
 * `ExponentPushToken[...]`. Verificat pe pachetul chiar instalat: funcția fixează
 * `type: "expo"` și pune STRING-ul brut întors de `exp.host` (deja în forma asta)
 * în `data`. `getDevicePushTokenAsync()` e altceva — întoarce jetonul FCM/APNs
 * brut, nu jetonul Expo — și n-ar trece niciodată de regexul de mai jos; nu e
 * ce trimite `src/lib/push/expo.ts` către `exp.host`, deci nu e ce trebuie
 * folosit la înregistrare.
 */
export const jetonSchema = z.object({
  jeton: z.string().regex(/^ExponentPushToken\[[^\]]{1,200}\]$/, "Jeton de push nevalid."),
  platforma: z.enum(["ios", "android"]),
});

/**
 * Cele patru stări posibile ale rândului activ pentru un jeton, la momentul
 * înregistrării. Clasificarea NU se face aici — are nevoie de citiri prin
 * clientul admin (ca să vadă rândul altcuiva, invizibil prin RLS) și, pentru
 * `propriu_neaccesibil`, de o încercare reală de UPDATE prin clientul de
 * server: nu există alt mod corect de-a ști dacă politica
 * `dispozitive_push_update` ar accepta scrierea, fără să reimplementăm în cod
 * predicatul ei (`user_id` + `organization_id = any(current_org_ids())`) — o
 * a doua copie a regulii ar putea diverge tăcut de cea reală.
 *
 * `propriu_neaccesibil` apare când utilizatorul a fost scos din organizația
 * rândului, sau organizația a fost suspendată: rândul e al lui, dar politica
 * nu-l mai lasă să-l atingă.
 */
export type StareRandJeton = "inexistent" | "propriu_scriibil" | "propriu_neaccesibil" | "altcuiva";

/** Ce trebuie făcut mai departe, dată fiind starea de mai sus. */
export type PasInregistrareJeton = "insereaza" | "gata" | "retrage_apoi_insereaza";

/**
 * Singurul loc care decide ramura de urmat la înregistrarea unui jeton —
 * extras din rută ca decizie pură, testabilă fără niciun client Supabase,
 * real sau fals.
 *
 * `propriu_neaccesibil` și `altcuiva` primesc ACEEAȘI ramură: rândul e „de
 * recuperat" prin clientul admin (retragere + eliberarea jetonului), nu „de
 * reîmprospătat" — o reîmprospătare simplă prin RLS ar rămâne blocată la
 * nesfârșit pe zero rânduri, fiindcă politica refuză ambele cazuri identic.
 */
export function decidePasInregistrareJeton(stare: StareRandJeton): PasInregistrareJeton {
  switch (stare) {
    case "inexistent":
      return "insereaza";
    case "propriu_scriibil":
      return "gata";
    case "propriu_neaccesibil":
    case "altcuiva":
      return "retrage_apoi_insereaza";
  }
}
