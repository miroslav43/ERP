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
