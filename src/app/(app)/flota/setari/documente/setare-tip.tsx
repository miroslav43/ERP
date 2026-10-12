"use client";

// src/app/(app)/flota/setari/documente/setare-tip.tsx

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { clasaBifa } from "@/components/ui/camp";
import { arataToast } from "@/components/ui/toast";

import { salveazaSetareTipDocument } from "../../actions-tipuri";

interface Proprietati {
  readonly tipId: string;
  readonly denumire: string;
  /** Valorile EFECTIVE ale firmei azi (setarea ei sau, fără ea, platforma). */
  readonly activ: boolean;
  readonly obligatoriu: boolean;
}

/**
 * Setarea firmei pe un tip DE PLATFORMĂ, pe rândul lui: „Folosit” și
 * „Obligatoriu”, cu un „Salvează” propriu. Un formular pe rând, nu unul pe
 * pagină: o eroare pe un tip nu înroșește restul listei, iar fiecare salvare e
 * o setare separată în audit.
 *
 * Obligatoriu fără „Folosit” nu se poate bifa: un tip retras nu se cere nimănui
 * (baza îl stinge oricum, `vdts_inainte`). Bifa se dezactivează, nu dispare,
 * ca omul să vadă de ce.
 */
export function SetareTip({ tipId, denumire, activ, obligatoriu }: Proprietati): ReactElement {
  const router = useRouter();
  const id = useId();
  const [folosit, setFolosit] = useState(activ);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();

  function trimite(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const date = new FormData(e.currentTarget);
    setEroare(null);
    porneste(async () => {
      const activNou = date.get("activ") === "on";
      const r = await salveazaSetareTipDocument({
        document_type_id: tipId,
        activ: activNou,
        obligatoriu: activNou && date.get("obligatoriu") === "on",
      });
      if (!r.ok) {
        setEroare(r.error.message);
        return;
      }
      arataToast({ fel: "reusita", text: `Setarea pentru „${denumire}” a fost salvată.` });
      router.refresh();
    });
  }

  return (
    <form onSubmit={trimite} className="flex flex-wrap items-center gap-x-4 gap-y-2" noValidate>
      <span className="inline-flex items-center gap-2">
        <input
          id={`${id}-activ`}
          name="activ"
          type="checkbox"
          className={clasaBifa}
          checked={folosit}
          onChange={(ev) => {
            setFolosit(ev.target.checked);
          }}
        />
        <label htmlFor={`${id}-activ`} className="text-corp">
          Folosit de firmă
        </label>
      </span>
      <span className="inline-flex items-center gap-2">
        <input
          id={`${id}-obligatoriu`}
          name="obligatoriu"
          type="checkbox"
          className={clasaBifa}
          defaultChecked={obligatoriu}
          disabled={!folosit}
        />
        <label htmlFor={`${id}-obligatoriu`} className="text-corp">
          Obligatoriu
        </label>
      </span>
      <Buton
        type="submit"
        varianta="secundar"
        disabled={inCurs}
        aria-label={`Salvează setarea pentru „${denumire}”`}
      >
        {inCurs ? "Se salvează…" : "Salvează"}
      </Buton>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota basis-full">
          {eroare}
        </p>
      )}
    </form>
  );
}
