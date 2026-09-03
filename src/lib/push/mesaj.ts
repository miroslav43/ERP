/**
 * Traducerea unui rând din `notifications` în mesajul pe care îl înghite Expo.
 *
 * Pur, fără I/O: se poate testa fără bază și fără rețea, iar defectele lui —
 * o cale ostilă, un titlu care depășește ce afișează sistemul — se prind aici,
 * nu în producție, pe telefonul cuiva.
 */

/** Ce afișează efectiv iOS și Android înainte de a tăia singure. */
const MAX_TITLU = 100;
const MAX_CORP = 240;

/** Unde ajunge o notificare fără link, sau cu unul în care nu avem încredere. */
const CALE_IMPLICITA = "/portal";

export type MesajPush = {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly data: { readonly cale: string };
  readonly sound: "default";
  readonly channelId: "implicit";
};

/**
 * Aceeași formă ca `check (link ~ '^/[^/\\]')` de pe `notifications.link`, din
 * `0001_kernel.sql`. Constrângerea din bază e prima barieră și e suficientă
 * pentru scrierile prin RLS; asta o dublează pentru rândurile scrise cu
 * `service_role`, care o ocolesc. Un `//evil.com` e URL absolut
 * protocol-relativ: deschis într-un WebView semnat cu numele firmei, ar fi
 * exact scenariul pe care constrângerea îl oprea pe web.
 */
function caleInterna(link: string | null): string {
  if (link === null) return CALE_IMPLICITA;
  return /^\/[^/\\]/.test(link) ? link : CALE_IMPLICITA;
}

export function construiesteMesaj(
  args: Readonly<{
    jeton: string;
    titlu: string;
    corp: string | null;
    link: string | null;
  }>,
): MesajPush {
  return {
    to: args.jeton,
    title: args.titlu.slice(0, MAX_TITLU),
    body: (args.corp ?? "").slice(0, MAX_CORP),
    data: { cale: caleInterna(args.link) },
    sound: "default",
    // Canalul se creează în aplicație, la pornire. Android ignoră notificările
    // trimise pe un canal inexistent, fără nicio eroare la expeditor.
    channelId: "implicit",
  };
}
