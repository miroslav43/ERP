import Script from "next/script";

import { BaraConsimtamant } from "./bara-consimtamant";
import { CHEIE_CONSIMTAMANT } from "./consimtamant";

/**
 * Măsurarea paginilor publice.
 *
 * ── DE CE DOAR AICI, NU ÎN LAYOUT-UL RĂDĂCINĂ ─────────────────────────────
 * Componenta stă în `(marketing)`, nu la rădăcină, și asta nu e o comoditate.
 * Montată la rădăcină, ar trimite la Google căile din interiorul aplicației:
 * `/angajati/…`, `/salarizare/…`, `/concedii/…`. Într-un produs de HR, până și
 * lista de rute vizitate spune ceva despre oamenii unei firme. Ce se măsoară e
 * pagina de PREZENTARE — de acolo vin vizitatorii necunoscuți, acolo are sens
 * întrebarea „a funcționat?”.
 *
 * ── DE CE SUB CONSIMȚĂMÂNT ────────────────────────────────────────────────
 * GA4 scrie cookie-uri, iar cookie-urile de analiză nu intră în excepția de
 * „strict necesare”: cer consimțământ prealabil. Pentru orice site ar fi o
 * obligație; pentru ăsta e și o chestiune de coerență — pagina `/incredere`
 * vinde exact disciplina datelor, iar `/legal/confidentialitate` o promite în
 * scris.
 *
 * Mecanismul e Consent Mode v2, forma pe care Google o documentează: refuzul e
 * IMPLICIT, iar biblioteca pornește oricum și trimite semnale fără cookie-uri
 * până când cineva acceptă. Nu se pierde nimic din ce se poate avea legal.
 *
 * ── DE CE `next/script`, DUPĂ CE DATELE STRUCTURATE FOLOSESC `<script>` NUD ─
 * Aici chiar se execută cod și contează CÂND. JSON-LD-ul din
 * `date-structurate.tsx` e text pe care îl citește un parser, deci merge randat
 * direct. Consimțământul implicit, în schimb, trebuie să fie în `dataLayer`
 * ÎNAINTE ca `gtag.js` să se încarce — de aceea e un `<script>` obișnuit, care
 * rulează la parsare, iar biblioteca vine `afterInteractive`, adică mai târziu.
 * Inversate, cookie-ul ar fi deja scris când sosește refuzul.
 */
export const ID_GA = "G-ZH3T2BSNJK";

/**
 * Consimțământul implicit, plus recitirea alegerii precedente.
 *
 * Se scrie o singură dată, aici, ca șirul cheii de stocare să nu existe în două
 * locuri. `try`/`catch` fiindcă `localStorage` ARUNCĂ, nu întoarce null, în
 * fereastră privată și când browserul are stocarea blocată.
 */
const CONSIMTAMANT_IMPLICIT = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{
  ad_storage:'denied',
  ad_user_data:'denied',
  ad_personalization:'denied',
  analytics_storage:'denied',
  wait_for_update:500
});
try{
  if(localStorage.getItem('${CHEIE_CONSIMTAMANT}')==='acceptat'){
    gtag('consent','update',{analytics_storage:'granted'});
  }
}catch(e){}
`;

const PORNIRE_GA = `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ID_GA}');
`;

export function Analitice() {
  return (
    <>
      {/* Rulează la parsare, înaintea bibliotecii. Ordinea e tot mecanismul. */}
      <script dangerouslySetInnerHTML={{ __html: CONSIMTAMANT_IMPLICIT }} />
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${ID_GA}`}
        strategy="afterInteractive"
      />
      <Script id="ga-pornire" strategy="afterInteractive">
        {PORNIRE_GA}
      </Script>
      <BaraConsimtamant />
    </>
  );
}
