"use client";

import { Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { arataToast } from "@/components/ui/toast";

import { atribuieSesizare } from "./actions";

/**
 * „Preiau eu” de pe rândul din coadă: gestionarul cu fișă își atribuie
 * sesizarea neatribuită dintr-un clic. Fără confirmare — atribuirea e
 * reversibilă (din fișă, „Fără tehnician”) și nu schimbă starea sesizării.
 */
export function ButonPreiau({ sesizareId }: Readonly<{ sesizareId: string }>): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();

  function preia(): void {
    porneste(async () => {
      const rezultat = await atribuieSesizare({
        id: sesizareId,
        atribuit_employee_id: null,
        eu: true,
      });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      arataToast({ fel: "reusita", text: "Sesizarea v-a fost atribuită." });
      router.refresh();
    });
  }

  return (
    <Buton varianta="tertiar" inCurs={inCurs} textInCurs="Se preia…" onClick={preia}>
      <Wrench aria-hidden="true" className="size-4" />
      Preiau eu
    </Buton>
  );
}
