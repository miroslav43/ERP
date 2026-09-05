/**
 * Traducerea unui rând din `notifications` în mesajul pe care îl înghite Expo.
 *
 * Pur, fără I/O: se poate testa fără bază și fără rețea, iar defectele lui —
 * o cale ostilă, un titlu care depășește ce afișează sistemul — se prind aici,
 * nu în producție, pe telefonul cuiva.
 */

import {
  caleaDePortal,
  type ContextDestinatar,
} from "@/app/(portal)/portal/notificarile-mele/legaturi";

/** Ce afișează efectiv iOS și Android înainte de a tăia singure. */
const MAX_TITLU = 100;
const MAX_CORP = 240;

/**
 * Unde ajunge o notificare fără link, cu unul în care nu avem încredere, sau cu
 * unul care nu are corespondent în portal.
 *
 * `/portal/notificarile-mele`, NU `/portal` (revizuirea finală). Omul tocmai a
 * atins o notificare: singurul ecran care îi arată SIGUR mesajul întreg e cutia
 * poștală, care randează și rândurile fără link, ca text. `/portal` e pagina de
 * start — corectă ca destinație de rezervă a aplicației, dar de-acolo mesajul pe
 * care l-a atins nu se mai vede, iar atingerea pare fără efect.
 */
const CALE_IMPLICITA = "/portal/notificarile-mele";

export type MesajPush = {
  readonly to: string;
  readonly title: string;
  readonly body: string;
  readonly data: { readonly cale: string };
  readonly sound: "default";
  readonly channelId: "implicit";
};

/**
 * Caractere de control (U+0000–U+001F și U+007F).
 *
 * Scris ca buclă, nu ca expresie regulată: un `[\u0000-\u001f]` ar fi corect,
 * dar `no-control-regex` din ESLint îl semnalează pe bună dreptate — regula
 * există tocmai fiindcă un caracter de control într-un regex e, de obicei, un
 * accident de copiere. Aici e intenționat, iar bucla o spune fără să ceară o
 * excepție de la regulă.
 */
function areCaractereDeControl(s: string): boolean {
  for (const caracter of s) {
    const cod = caracter.codePointAt(0) ?? 0;
    if (cod < 0x20 || cod === 0x7f) return true;
  }
  return false;
}

/**
 * Calea pe care o deschide aplicația la atingerea notificării.
 *
 * DOUĂ PORȚI, ÎN ORDINEA ASTA — și niciuna nu o poate înlocui pe cealaltă.
 *
 * 1. FORMA. Aceeași ca `check (link ~ '^/[^/\\]')` de pe `notifications.link`,
 *    din `0001_kernel.sql`. Constrângerea din bază e prima barieră și e
 *    suficientă pentru scrierile prin RLS; asta o dublează pentru rândurile
 *    scrise cu `service_role`, care o ocolesc. Un `//evil.com` e URL absolut
 *    protocol-relativ: deschis într-un WebView semnat cu numele firmei, ar fi
 *    exact scenariul pe care constrângerea îl oprea pe web. Poarta asta rămâne
 *    PRIMA și pentru un motiv mecanic: `caleaDePortal` caută linkul într-un
 *    obiect literal (`FIXE`), deci un șir ca `"constructor"` ar găsi acolo o
 *    moștenire de pe `Object.prototype`. Cu forma verificată întâi, niciun șir
 *    care nu începe cu `/` nu ajunge până acolo.
 *
 * 2. DESTINAȚIA E ÎN PORTAL. Verificarea de formă, singură, lăsa să treacă
 *    ORICE cale de aplicație mare — iar asta erau, la revizuirea finală, TOATE
 *    cele 67 de notificări cu link din baza vie: `/pontaj/saptamana`,
 *    `/concedii/<uuid>`, `/anunturi/<uuid>`, `/concedii/aprobari`,
 *    `/pontaj/aprobare`. Zero pe `/portal/…`. Pentru un `employee`,
 *    `(app)/layout.tsx` îl trimite înapoi la `/portal`, deci atingerea
 *    notificării nu producea niciun mesaj; pentru `manager`/`hr`/`org_admin`,
 *    ateriza ERP-ul de birou întreg în învelișul de telefon.
 *
 * Traducerea NU e o listă nouă: e exact `caleaDePortal`, lista albă deja
 * folosită de cutia poștală din portal (`notificarile-mele/legaturi.ts`) și deja
 * testată acolo. O a doua listă ar diverge de prima chiar în ziua în care
 * cineva adaugă un tip nou de notificare — iar divergența s-ar vedea doar pe
 * telefon. Ce nu poate traduce (legăturile de aprobator) cade pe
 * `CALE_IMPLICITA`: în cutia poștală, unde mesajul se citește oricum întreg.
 *
 * `context` e a treia poartă, și singura care nu se poate decide din link:
 * `/concedii/<uuid>` duce în portal la „cererea MEA", dar aceeași legătură e
 * trimisă de triggere și HR-ului, și aprobatorilor. Fără context, nu se
 * traduce — vezi `ContextDestinatar`. Omiterea lui e sigură prin construcție:
 * costă o aterizare directă, nu produce un 404.
 */
function caleDeDeschis(link: string | null, context: ContextDestinatar | undefined): string {
  if (link === null) return CALE_IMPLICITA;
  if (!/^\/[^/\\]/.test(link)) return CALE_IMPLICITA;
  // Caractere de control, în plus față de forma din bază. `^\/[^/\\]` singur
  // acceptă `/\t/evil.com`: al doilea caracter e TAB, deci nu e `/` și trece —
  // iar unele parsere de URL elimină tab-ul și newline-ul înainte să
  // interpreteze, transformând șirul în `//evil.com`, adică exact URL-ul
  // absolut protocol-relativ pe care prima poartă îl oprea.
  //
  // INACCESIBIL AZI: toate valorile `notifications.link` sunt literale în cod
  // sau derivate dintr-un UUID, niciuna intrare brută de utilizator. Poarta e
  // aici fiindcă e gratuită și fiindcă ziua în care cineva scrie o notificare
  // cu o cale venită dintr-un formular nu va semăna cu o zi de securitate.
  //
  // Constrângerea din `0001_kernel.sql:381` rămâne forma veche — o migrare
  // aplicată nu se mai atinge. Straturile nu sunt deci identice, deliberat:
  // cel de aici e mai strict, iar asta e direcția sigură a asimetriei.
  if (areCaractereDeControl(link)) return CALE_IMPLICITA;
  return caleaDePortal(link, context) ?? CALE_IMPLICITA;
}

export function construiesteMesaj(
  args: Readonly<{
    jeton: string;
    titlu: string;
    corp: string | null;
    link: string | null;
    context?: ContextDestinatar;
  }>,
): MesajPush {
  return {
    to: args.jeton,
    title: args.titlu.slice(0, MAX_TITLU),
    body: (args.corp ?? "").slice(0, MAX_CORP),
    data: { cale: caleDeDeschis(args.link, args.context) },
    sound: "default",
    // Canalul se creează în aplicație, la pornire. Android ignoră notificările
    // trimise pe un canal inexistent, fără nicio eroare la expeditor.
    channelId: "implicit",
  };
}
