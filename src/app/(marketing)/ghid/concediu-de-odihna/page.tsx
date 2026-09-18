// src/app/(marketing)/ghid/concediu-de-odihna/page.tsx
import type { Metadata } from "next";

import { CONCEDIU_ODIHNA } from "@/content/legal/concediu-odihna";

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
export const metadata: Metadata = {
  title: "Concediu de odihnă: zile, programare, bani",
  description:
    "Cele 20 de zile lucrătoare, programarea până la sfârșitul anului, cele 10 zile neîntrerupte, reportul de 18 luni și ce a schimbat decizia ÎCCJ din august 2026.",
  alternates: { canonical: "/ghid/concediu-de-odihna" },
};

export default function PaginaConcediuDeOdihna() {
  return <RandarePaginaLege text={CONCEDIU_ODIHNA} />;
}
