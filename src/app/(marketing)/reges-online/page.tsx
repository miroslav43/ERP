// src/app/(marketing)/reges-online/page.tsx
import type { Metadata } from "next";

import { REGES } from "@/content/legal/reges";

import { metadatePagina } from "../_componente/metadate";
import { RandarePaginaLege } from "../_componente/pagina-lege";

/**
 * REGES-ONLINE — HG 295/2025.
 *
 * Pagina există în primul rând pentru tabela termenelor din art. 5: în hotărâre
 * ele trimit la literele din art. 4 alin. (2), deci un singur termen se află
 * sărind între două articole. Puse cap la cap, se citesc dintr-o privire.
 */
export const metadata: Metadata = metadatePagina({
  titlu: "REGES-ONLINE: registrul salariaților, termene",
  descriere:
    "Registrul salariaților în REGES-ONLINE: termenele din HG 295/2025 cap la cap — ziua anterioară, 3, 5, 10 sau 20 de zile lucrătoare — și amenzile.",
  cale: "/reges-online",
});

export default function PaginaReges() {
  return <RandarePaginaLege text={REGES} />;
}
