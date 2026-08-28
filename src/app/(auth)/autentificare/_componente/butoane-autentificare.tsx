// src/app/(auth)/autentificare/_componente/butoane-autentificare.tsx
"use client";

import { useState, type ReactElement } from "react";
import { useFormStatus } from "react-dom";

import { trimiteLinkMagic } from "../actions";
import { useSemnalIncarcare } from "@/components/incarcare/use-incarcare";
import { Buton } from "@/components/ui/buton";

/**
 * Cele două butoane ale ecranului de autentificare.
 *
 * De ce o componentă și nu două `<ButonTrimite>`: butoanele împart ACELAȘI
 * `<form>`, iar `useFormStatus` raportează starea formularului, nu a butonului
 * apăsat. Cu două instanțe independente, ambele ar porni rotița deodată — ceea
 * ce e mai rău decât nimic, fiindcă sugerează că s-au trimis amândouă.
 *
 * ── DE CE BLOCAREA NU E COSMETICĂ AICI ────────────────────────────────────
 * `autentificarePrinParola` are `DURATA_MINIMA_MS = 700` scris în cod
 * (`../actions.ts:17`) — un prag anti-enumerare, deci 700 ms de tăcere
 * GARANTATĂ, pe toate ramurile, inclusiv pe cea de succes. Peste el vine
 * GoTrue, apoi `redirect` către „/", apoi încă un redirect din `proxy.ts` către
 * `/panou`, apoi învelișul `(app)` cu valurile lui.
 *
 * În tot intervalul ăsta butoanele rămâneau apăsabile. Iar `limitaAtinsa`
 * (`../actions.ts:58`) consumă din bugetul de 5 încercări la 15 minute la
 * FIECARE trecere, inclusiv la cele reușite — deci omul care apasă de cinci ori
 * fiindcă nu vede nimic își blochează singur contul, exact în clipa în care
 * autentificarea lui tocmai reușise. Blocarea butoanelor nu îmbunătățește
 * percepția, elimină defectul.
 */
export function ButoaneAutentificare(): ReactElement {
  const { pending } = useFormStatus();
  const [apasat, setApasat] = useState<"parola" | "magic" | null>(null);

  useSemnalIncarcare(pending, apasat === "magic" ? undefined : "aplicația");

  const eParola = pending && apasat !== "magic";
  const eMagic = pending && apasat === "magic";

  return (
    <>
      {/* Singurul navy din zonă: acțiunea care te duce înăuntru. */}
      <Buton
        type="submit"
        varianta="primar"
        onClick={() => setApasat("parola")}
        inCurs={eParola}
        textInCurs="Se verifică…"
        disabled={pending}
      >
        Intră în cont
      </Buton>

      <div className="border-border relative border-t pt-4 text-center">
        <span className="bg-surface text-muted-foreground text-nota absolute -top-2.5 left-1/2 -translate-x-1/2 px-2">
          sau
        </span>
        {/* `formNoValidate`: linkul magic nu are nevoie de parolă. */}
        <Buton
          type="submit"
          varianta="secundar"
          formAction={trimiteLinkMagic}
          formNoValidate
          onClick={() => setApasat("magic")}
          inCurs={eMagic}
          textInCurs="Se trimite linkul…"
          disabled={pending}
          className="w-full"
        >
          Trimite-mi un link de autentificare
        </Buton>
      </div>
    </>
  );
}
