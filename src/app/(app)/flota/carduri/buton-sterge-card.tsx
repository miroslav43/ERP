"use client";

import { Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import { stergeCard } from "./actions";
import { ButonConfirmat } from "./buton-confirmat";

/** Ștergerea unui card introdus greșit. Cardul pierdut sau înlocuit se ANULEAZĂ, nu se șterge. */
export function ButonStergeCard({
  id,
  eticheta,
}: Readonly<{ id: string; eticheta: string }>): ReactElement {
  return (
    <ButonConfirmat
      pictograma={<Trash2 aria-hidden="true" className="size-4" />}
      ariaLabel={`Șterge cardul ${eticheta}`}
      titlu={`Ștergeți cardul ${eticheta}?`}
      consecinta="Cardul dispare din listă și scadența lui iese din alerte. Tranzacțiile importate deja rămân. Pentru un card pierdut sau înlocuit, schimbați-i starea în „Anulat”: așa istoricul rămâne lizibil."
      etichetaConfirmare="Șterge cardul"
      distructiv
      mesajReusita={() => "Cardul a fost șters."}
      executa={() => stergeCard({ id })}
    />
  );
}
