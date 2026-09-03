import type { ContinutLanding } from "@/content/landing/tipuri";

import {
  BandaClienti,
  BandaContact,
  BandaDovada,
  BandaHero,
  BandaImplementare,
  BandaIntrebari,
  BandaPreturi,
  BandaRealitatea,
} from "./benzi/comercial";
import {
  BandaComparatie,
  BandaConformitate,
  BandaIzolare,
  BandaOnestitate,
  BandaVerticale,
} from "./benzi/incredere";
import {
  BandaEcrane,
  BandaFluxuri,
  BandaModule,
  BandaPlatforma,
  BandaPontajLivrat,
  BandaPontajViitor,
  BandaRoluri,
} from "./benzi/produs";

/**
 * Orchestrarea landing-ului: nouăsprezece benzi, în ordine.
 *
 * Fișierul ăsta avea 624 de linii și conținea marcajul tuturor benzilor. Nu era
 * o problemă de gust: o bandă nu putea fi mutată pe o pagină proprie fără să fie
 * rescrisă, deci tot conținutul era condamnat să rămână pe `/`. Acum e o listă
 * de compunere — ce se vede pe pagina de start se citește dintr-o privire, iar o
 * bandă se mută pe altă pagină mutându-i rândul.
 *
 * Componenta nu conține niciun text: tot ce se citește vine din `text`, adică
 * din `ro.ts` sau `en.ts`. De aceea aceeași funcție randează ambele limbi.
 */
export function PaginaLanding({ text }: { text: ContinutLanding }) {
  return (
    <>
      <BandaHero text={text} />
      <BandaDovada text={text} />
      <BandaRealitatea text={text} />
      <BandaPlatforma text={text} />
      <BandaModule text={text} />
      <BandaEcrane text={text} />
      {/* Cele două benzi de pontaj sunt o pereche: hârtia spune ce merge azi,
          cerneala ce e pe foaia de parcurs. Despărțite, fraza-graniță dintre ele
          („de aici în jos vorbesc despre ce vreau să construiesc”) rămâne fără
          obiect. */}
      <BandaPontajLivrat text={text} />
      <BandaPontajViitor text={text} />
      <BandaFluxuri text={text} />
      <BandaRoluri text={text} />
      <BandaIzolare text={text} />
      <BandaConformitate text={text} />
      <BandaOnestitate text={text} />
      <BandaVerticale text={text} />
      <BandaComparatie text={text} />
      <BandaPreturi text={text} />
      <BandaImplementare text={text} />
      <BandaIntrebari text={text} />
      <BandaClienti text={text} />
      <BandaContact text={text} />
    </>
  );
}
