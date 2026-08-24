// src/app/(app)/angajati/[id]/formular-inceteaza-contract.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";

import { inceteazaContract } from "../actions";

interface Proprietati {
  readonly contractId: string;
}

export function FormularInceteazaContract({ contractId }: Proprietati) {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idIncetatLa = useId();
  const idTemei = useId();
  const idMotiv = useId();
  const idArhiveaza = useId();

  function trimite(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await inceteazaContract({
        contract_id: contractId,
        incetat_la: String(fd.get("incetat_la") ?? ""),
        temei_incetare: String(fd.get("temei_incetare") ?? ""),
        motiv_incetare: String(fd.get("motiv_incetare") ?? ""),
        arhiveaza_fisa: fd.get("arhiveaza_fisa") === "on",
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setDeschis(false);
      router.refresh();
    });
  }

  if (!deschis) {
    return (
      <Buton
        varianta="distructiv"
        className="mt-3"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Încetează contractul
      </Buton>
    );
  }

  return (
    <form
      action={trimite}
      className="border-danger/40 rounded-control mt-3 grid gap-3 border p-3 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idIncetatLa} className="text-corp">
          Data încetării
        </label>
        <input
          id={idIncetatLa}
          name="incetat_la"
          type="date"
          required
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idTemei} className="text-corp">
          Temei legal
        </label>
        <input
          id={idTemei}
          name="temei_incetare"
          type="text"
          required
          minLength={2}
          maxLength={120}
          placeholder="Ex. art. 55 lit. a) Codul muncii"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idMotiv} className="text-corp">
          Motivul încetării
        </label>
        <textarea
          id={idMotiv}
          name="motiv_incetare"
          required
          minLength={3}
          maxLength={500}
          rows={2}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="text-corp flex items-center gap-2 sm:col-span-2">
        <input id={idArhiveaza} name="arhiveaza_fisa" type="checkbox" />
        <label htmlFor={idArhiveaza}>
          Arhivează fișa angajatului (dacă acesta nu mai are alt contract activ)
        </label>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Buton type="submit" varianta="distructiv" inCurs={inCurs} textInCurs="Se salvează…">
          Confirmă încetarea
        </Buton>
        <Buton
          varianta="link"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
        >
          Renunță
        </Buton>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-corp">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
