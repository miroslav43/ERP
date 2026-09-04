// src/app/(marketing)/ghid/control-itm/page.tsx
import type { Metadata } from "next";

import { CONTROL_ITM } from "@/content/legal/control-itm";

import { RandarePaginaLege } from "../../_componente/pagina-lege";

/**
 * Ghid: controlul ITM în relații de muncă.
 *
 * Sub `/ghid/` fiindcă e altceva decât cele două pagini de obligație: acolo se
 * răspunde la „ce cere legea", aici la „ce se întâmplă când vine cineva să
 * verifice". Aceeași randare, fiindcă structura e aceeași — inclusiv secțiunea
 * care spune unde se termină certitudinea, care aici e chiar necesară: lista de
 * documente vine de la un inspectorat, iar ordonarea problemelor e concluzia
 * noastră, nu un document oficial.
 */
export const metadata: Metadata = {
  title: "Control ITM: ce documente se cer și ce se verifică",
  description:
    "Lista documentelor cerute la un control de fond în relații de muncă, cele patru locuri unde apar de obicei problemele, și ce s-a schimbat din decembrie 2025.",
  alternates: { canonical: "/ghid/control-itm" },
};

export default function PaginaControlItm() {
  return <RandarePaginaLege text={CONTROL_ITM} />;
}
