// src/app/(marketing)/ghid/concediu-de-odihna/page.tsx
import type { Metadata } from "next";

import { CONCEDIU_ODIHNA } from "@/content/legal/concediu-odihna";

import { metadatePagina } from "../../_componente/metadate";
import { RandarePaginaLege } from "../../_componente/pagina-lege";

/**
 * Ghid: concediul de odihnă.
 *
 * Sub `/ghid/`, lângă controlul ITM, nu la rădăcină ca `/evidenta-orelor-de-munca`
 * și `/reges-online`: alea două răspund la o obligație cu termen și amendă
 * proprie, asta la un pachet de reguli care se citesc împreună.
 *
 * Aceeași randare ca celelalte trei, inclusiv secțiunea „ce nu e sigur" — aici
 * chiar necesară, fiindcă întrebarea cea mai căutată de pe pagină (câte zile
 * pentru un an lucrat parțial) n-are răspuns în Cod, iar tot internetul
 * răspunde ca și cum ar avea.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "Concediu de odihnă: câte zile ai pe an și lună",
  descriere:
    "Câte zile de concediu ai: minimum 20 lucrătoare pe an, cam 1,67 pe lună lucrată. Plus programarea, cele 10 zile neîntrerupte și reportul de 18 luni.",
  cale: "/ghid/concediu-de-odihna",
});

export default function PaginaConcediuDeOdihna() {
  return <RandarePaginaLege text={CONCEDIU_ODIHNA} />;
}
