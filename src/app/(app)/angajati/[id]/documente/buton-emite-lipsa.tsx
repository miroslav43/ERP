// src/app/(app)/angajati/[id]/documente/buton-emite-lipsa.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";

import { emiteDocumenteLipsa } from "./actions";

/**
 * Emite documentele care lipsesc din dosar.
 *
 * ── DE CE EXISTĂ ───────────────────────────────────────────────────────────
 * Fiecare avertisment al înrolării spune „Îl puteți emite din fișa angajatului,
 * secțiunea Documente". Până acum, acea cale NU exista: singurul apelant al
 * generatorului era acțiunea de înrolare, iar textul trimitea omul către un
 * buton imaginar — exact în situația în care avea nevoie de el.
 *
 * ── DE CE „LIPSĂ", NU „DIN NOU" ────────────────────────────────────────────
 * Fiecare emitere consumă un număr din registrul seriei, iar
 * `hr_issued_documents` n-are politică DELETE: un al doilea contract de muncă
 * pentru același om nu se poate șterge, doar anula. Butonul cere serverului să
 * calculeze ce lipsește și să emită exact atât. Apăsat de două ori, a doua oară
 * spune „toate au fost deja emise".
 */
export function ButonEmiteLipsa({ employeeId }: { readonly employeeId: string }) {
  const router = useRouter();
  const [inCurs, setInCurs] = useState(false);
  const [eroare, setEroare] = useState<string | null>(null);
  const [reusita, setReusita] = useState<string | null>(null);

  async function emite(): Promise<void> {
    setInCurs(true);
    setEroare(null);
    setReusita(null);
    const rezultat = await emiteDocumenteLipsa({ employeeId });
    setInCurs(false);

    if (!rezultat.ok) {
      setEroare(rezultat.error.message);
      return;
    }
    const cate = rezultat.data.documente.length;
    setReusita(
      cate === 1 ? "Un document a fost emis." : `${String(cate)} documente au fost emise.`,
    );
    // Avertismentele contează la fel de mult ca reușita: un document care tot
    // n-a putut fi emis (o variabilă lipsă din fișă) ar dispărea altfel.
    if (rezultat.data.avertismente.length > 0) {
      setEroare(rezultat.data.avertismente.join(" "));
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <Buton
        varianta="secundar"
        inCurs={inCurs}
        textInCurs="Se emit…"
        onClick={() => {
          void emite();
        }}
      >
        Emite documentele lipsă
      </Buton>
      {reusita === null ? null : <Callout fel="neutru">{reusita}</Callout>}
      {eroare === null ? null : <Callout fel="atentie">{eroare}</Callout>}
    </div>
  );
}
