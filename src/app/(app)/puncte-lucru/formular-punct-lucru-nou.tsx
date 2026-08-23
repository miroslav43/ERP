// src/app/(app)/puncte-lucru/formular-punct-lucru-nou.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { JUDETE } from "@/schemas/organization";
import { creeazaPunctLucru } from "./actions";

export function FormularPunctLucruNou() {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idDenumire = useId();
  const idAdresa = useId();
  const idJudet = useId();
  const idOras = useId();
  const idCodPostal = useId();

  function trimite(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const judet = String(fd.get("judet") ?? "");
      const rezultat = await creeazaPunctLucru({
        denumire: String(fd.get("denumire") ?? ""),
        adresa: String(fd.get("adresa") ?? ""),
        judet: judet === "" ? null : judet,
        oras: String(fd.get("oras") ?? ""),
        cod_postal: String(fd.get("cod_postal") ?? ""),
        sediu_principal: fd.get("sediu_principal") === "on",
        observatii: null,
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
        varianta="primar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Punct de lucru nou
      </Buton>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idDenumire} className="text-corp font-medium">
          Denumire *
        </label>
        <input
          id={idDenumire}
          name="denumire"
          type="text"
          required
          maxLength={160}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idJudet} className="text-corp font-medium">
          Județ
        </label>
        <select
          id={idJudet}
          name="judet"
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        >
          <option value="">— Alegeți —</option>
          {JUDETE.map((judet) => (
            <option key={judet} value={judet}>
              {judet}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idOras} className="text-corp font-medium">
          Localitate
        </label>
        <input
          id={idOras}
          name="oras"
          type="text"
          maxLength={80}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idCodPostal} className="text-corp font-medium">
          Cod poștal
        </label>
        <input
          id={idCodPostal}
          name="cod_postal"
          type="text"
          maxLength={10}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idAdresa} className="text-corp font-medium">
          Adresă
        </label>
        <input
          id={idAdresa}
          name="adresa"
          type="text"
          maxLength={240}
          className="border-foreground/60 rounded-control text-corp border px-3 py-2"
        />
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <input
          id={`${idDenumire}-principal`}
          name="sediu_principal"
          type="checkbox"
          className="border-border size-4 rounded"
        />
        <label htmlFor={`${idDenumire}-principal`} className="text-corp">
          Sediu principal
        </label>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se creează…">
          Creează punctul de lucru
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
