// src/app/(marketing)/ghid/zile-libere/page.tsx
import type { Metadata } from "next";

import { ANUL_CURENT, ZILE_LIBERE } from "@/content/legal/zile-libere";

import { metadatePagina } from "../../_componente/metadate";
import { RandarePaginaLege } from "../../_componente/pagina-lege";

/**
 * Anii din titlu sunt cei ai construirii paginii — ca în conținut: pagina e
 * statică, iar fiecare deploy o reface. „zile libere 2026” e forma căutată.
 */
export const metadata: Metadata = metadatePagina({
  titlu: `Zile libere legale ${String(ANUL_CURENT)} și ${String(ANUL_CURENT + 1)}: calendar`,
  descriere: `Toate zilele libere legale din ${String(ANUL_CURENT)} și ${String(ANUL_CURENT + 1)}, cu ziua săptămânii, plus zilele lucrătoare din fiecare lună. Ce spune Codul muncii despre lucrul de sărbători.`,
  cale: "/ghid/zile-libere",
});

export default function PaginaZileLibere() {
  return <RandarePaginaLege text={ZILE_LIBERE} />;
}
