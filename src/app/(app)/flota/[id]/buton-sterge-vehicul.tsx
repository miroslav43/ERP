"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { stergeVehicul } from "../actions";

/**
 * Ștergerea vehiculului din evidență.
 *
 * ── ASTA NU E IEȘIREA DIN PARC ───────────────────────────────────────────────
 * O mașină vândută sau casată se trece pe starea potrivită din caseta de
 * modificare: rămâne în evidență, cu data și motivul ieșirii, iar foile ei de
 * parcurs se pot citi în continuare. Butonul de aici e pentru mașina care n-ar
 * fi trebuit să existe — numărul tastat greșit, rândul dublat, proba făcută la
 * instalare. Distincția e scrisă în `consecinta`, fiindcă din două butoane
 * alăturate nu se deduce singură.
 *
 * ── DE CE SE CERE TASTAREA NUMĂRULUI ─────────────────────────────────────────
 * Ștergerea e logică, deci reversibilă printr-un `UPDATE` în bază — dar nu din
 * aplicație, unde nu există ecran de coș. Practic, pentru cine folosește
 * produsul, e ireversibilă. Numărul de înmatriculare e și cuvântul cel mai
 * potrivit de tastat: e chiar lucrul de care trebuie să fii sigur.
 *
 * Se cere în forma NORMALIZATĂ de bază (majuscule, fără spații), fiindcă asta e
 * și forma afișată ca titlu al fișei — omul copiază ce vede.
 */
interface Proprietati {
  readonly id: string;
  readonly nrInmatriculare: string;
  readonly descriere: string;
  readonly stare: string;
}

export function ButonStergeVehicul({
  id,
  nrInmatriculare,
  descriere,
  stare,
}: Proprietati): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await stergeVehicul({ id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: `Vehiculul ${nrInmatriculare} a fost șters.` });
      // `push`, nu `refresh`: fișa pe care stăm tocmai a încetat să existe.
      router.push("/flota");
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
        Șterge vehiculul
      </Buton>

      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Ștergeți vehiculul din evidență?"
        consecinta="Mașina dispare din parcul auto, din selectorul foilor de parcurs și din semaforul de scadențe, împreună cu documentele ei. Foile de parcurs deja înregistrate rămân în bază, dar fără fișa mașinii. Dacă vehiculul a fost vândut sau casat, închideți-l din „Modifică” în loc să-l ștergeți — acolo istoricul rămâne întreg."
        cifre={[
          { eticheta: "Vehicul", valoare: nrInmatriculare },
          { eticheta: "Descriere", valoare: descriere },
          { eticheta: "Stare", valoare: stare },
        ]}
        etichetaConfirmare="Șterge vehiculul"
        distructiv
        cereTastare={nrInmatriculare}
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
