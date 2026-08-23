// src/app/(app)/angajati/[id]/buton-incheie-componenta.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";

import { incheieComponentaAngajat } from "./componente-actions";

interface Proprietati {
  readonly id: string;
  readonly employeeId: string;
  /** Numele componentei, ca omul să vadă în confirmare CE încheie. */
  readonly denumire: string;
}

/**
 * Încheierea unui spor sau a unei prime — o schimbare de salariu, la un clic.
 *
 * Două defecte reparate aici, ambele tăcute:
 *
 *  1. Nu întreba nimic. Butonul stătea în capătul rândului, la câțiva pixeli de
 *     alte controale, iar apăsarea lui tăia definitiv o componentă salarială.
 *  2. Rezultatul acțiunii se ARUNCA: `await incheieComponentaAngajat(...)` fără
 *     să se uite nimeni la `rezultat.ok`, urmat necondiționat de
 *     `router.refresh()`. Un refuz de permisiune sau un UPDATE respins de
 *     clauza `USING` (zero rânduri, fără eroare) arăta exact ca o reușită:
 *     ecranul se reîmprospăta, componenta rămânea activă, iar omul pleca
 *     convins că a încheiat-o.
 */
export function ButonIncheieComponenta({ id, employeeId, denumire }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deschis, setDeschis] = useState(false);

  function confirma(): void {
    porneste(async () => {
      const rezultat = await incheieComponentaAngajat({ id, employee_id: employeeId });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeschis(false);
      arataToast({ fel: "reusita", text: `„${denumire}” a fost încheiată.` });
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
        Încheie
      </Buton>
      <ConfirmareActiune
        deschis={deschis}
        laInchidere={() => {
          setDeschis(false);
        }}
        titlu="Încheiați componenta salarială?"
        consecinta={`„${denumire}” nu va mai intra în statele de plată începând cu luna în curs. Operațiunea nu se poate anula din interfață.`}
        etichetaConfirmare="Încheie componenta"
        distructiv
        inCurs={inCurs}
        laConfirmare={confirma}
      />
    </>
  );
}
