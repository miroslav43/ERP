// src/app/(app)/angajati/[id]/formular-inceteaza-contract.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
      <button
        type="button"
        onClick={() => {
          setDeschis(true);
        }}
        className="text-danger border-danger/40 hover:bg-danger/8 mt-3 rounded-md border px-3 py-1.5 text-sm font-medium"
      >
        Încetează contractul
      </button>
    );
  }

  return (
    <form
      action={trimite}
      className="border-danger/40 mt-3 grid gap-3 rounded-md border p-3 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idIncetatLa} className="text-sm">
          Data încetării
        </label>
        <input
          id={idIncetatLa}
          name="incetat_la"
          type="date"
          required
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idTemei} className="text-sm">
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
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idMotiv} className="text-sm">
          Motivul încetării
        </label>
        <textarea
          id={idMotiv}
          name="motiv_incetare"
          required
          minLength={3}
          maxLength={500}
          rows={2}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-2 text-sm sm:col-span-2">
        <input id={idArhiveaza} name="arhiveaza_fisa" type="checkbox" />
        <label htmlFor={idArhiveaza}>
          Arhivează fișa angajatului (dacă acesta nu mai are alt contract activ)
        </label>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-danger text-danger-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
        >
          {inCurs ? "Se salvează…" : "Confirmă încetarea"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDeschis(false);
            setEroare(null);
          }}
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Renunță
        </button>
        {eroare === null ? null : (
          <p role="alert" className="text-danger text-sm">
            {eroare}
          </p>
        )}
      </div>
    </form>
  );
}
