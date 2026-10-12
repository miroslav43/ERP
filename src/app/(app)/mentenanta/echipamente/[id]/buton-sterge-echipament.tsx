"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergeEchipament } from "../actions";

/**
 * Ștergerea logică a echipamentului — `ConfirmareActiune` cu codul tastat
 * (`cereTastare`) și cu cifrele a ceea ce dispare odată cu el. Baza refuză cât
 * există sesizări deschise; mesajul ei ajunge în toast.
 */
export function ButonStergeEchipament({
  echipamentId,
  cod,
  planuri,
  citiri,
}: Readonly<{ echipamentId: string; cod: string; planuri: number; citiri: number }>): ReactElement {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergeEchipament({ id: echipamentId, confirmare: cod });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: `Echipamentul ${cod} a fost șters din evidență.` });
      router.push("/mentenanta/echipamente");
      router.refresh();
    });
  }

  return (
    <>
      <Buton
        varianta="distructiv"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
        Șterge
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu={`Ștergeți echipamentul ${cod}?`}
        consecinta="Echipamentul iese din evidență împreună cu planurile și citirile lui de contor. Intervențiile și sesizările închise rămân în istoric. Nu se poate anula din aplicație."
        cifre={[
          { eticheta: "Planuri de mentenanță", valoare: String(planuri) },
          { eticheta: "Citiri de contor", valoare: String(citiri) },
        ]}
        etichetaConfirmare="Șterge echipamentul"
        distructiv
        cereTastare={cod}
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
