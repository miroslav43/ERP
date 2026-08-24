"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Buton } from "@/components/ui/buton";
import { STARI_OBIECT } from "@/schemas/inventory";
import { ETICHETE_STARE } from "../etichete";
import { returneazaObiect } from "../actions";

interface Proprietati {
  readonly alocareId: string;
}

interface ValoriFormular {
  stare_la_returnare: string;
  observatii: string;
}

const CLASA_CAMP = "mt-1 w-full rounded-control border border-foreground/60 px-3 py-2 text-corp";

export function FormularReturnare({ alocareId }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [mesajSucces, setMesajSucces] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<ValoriFormular>({
    defaultValues: { stare_la_returnare: "bun", observatii: "" },
  });

  function trimite(valori: ValoriFormular): void {
    setEroare(null);
    setMesajSucces(null);
    porneste(async () => {
      const rezultat = await returneazaObiect({ id: alocareId, ...valori });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      // Returnare cu starea „defect” mută obiectul în reparație, nu în stoc —
      // mesajul de succes trebuie să o spună (0019/V1b).
      setMesajSucces(
        valori.stare_la_returnare === "defect"
          ? "Returnarea a fost înregistrată. Obiectul a trecut în starea „În reparație”."
          : "Returnarea a fost înregistrată. Obiectul revine în stoc.",
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit(trimite)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="stare_la_returnare" className="text-corp block font-medium">
            Stare la returnare <span aria-hidden="true">*</span>
          </label>
          <select
            id="stare_la_returnare"
            aria-required="true"
            className={CLASA_CAMP}
            {...register("stare_la_returnare", { required: true })}
          >
            {STARI_OBIECT.map((valoare) => (
              <option key={valoare} value={valoare}>
                {ETICHETE_STARE[valoare]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="observatii-returnare" className="text-corp block font-medium">
          Observații
        </label>
        <textarea
          id="observatii-returnare"
          rows={2}
          className={CLASA_CAMP}
          {...register("observatii")}
        />
      </div>

      <div aria-live="polite">
        {eroare !== null ? (
          <p className="border-danger bg-danger/8 text-danger rounded-control text-corp border p-3">
            {eroare}
          </p>
        ) : null}
        {mesajSucces !== null ? (
          <p className="border-success/40 bg-surface text-foreground rounded-control text-corp border p-3">
            {mesajSucces}
          </p>
        ) : null}
      </div>

      <Buton
        type="submit"
        varianta="primar"
        disabled={mesajSucces !== null}
        inCurs={inCurs}
        textInCurs="Se înregistrează…"
      >
        Înregistrează returnarea
      </Buton>
    </form>
  );
}
