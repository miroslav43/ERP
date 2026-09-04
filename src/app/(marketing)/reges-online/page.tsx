// src/app/(marketing)/reges-online/page.tsx
import type { Metadata } from "next";

import { REGES } from "@/content/legal/reges";

import { RandarePaginaLege } from "../_componente/pagina-lege";

/**
 * REGES-ONLINE — HG 295/2025.
 *
 * Pagina există în primul rând pentru tabela termenelor din art. 5: în hotărâre
 * ele trimit la literele din art. 4 alin. (2), deci un singur termen se află
 * sărind între două articole. Puse cap la cap, se citesc dintr-o privire.
 */
export const metadata: Metadata = {
  title: "REGES-ONLINE 2026: termene de transmitere și amenzi",
  description:
    "Toate termenele din HG 295/2025, puse cap la cap, și cele trei amenzi pe care presa le confundă. Ce se transmite în ziua anterioară, ce în 3, 5, 10 sau 20 de zile lucrătoare.",
  alternates: { canonical: "/reges-online" },
};

export default function PaginaReges() {
  return <RandarePaginaLege text={REGES} />;
}
