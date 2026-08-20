// src/app/(app)/functii/formular-functie-noua.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { creeazaFunctie } from "./actions";

export function FormularFunctieNoua() {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idCod = useId();
  const idDenumire = useId();
  const idCodCor = useId();
  const idNivelStudii = useId();
  const idDescriere = useId();

  function trimite(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await creeazaFunctie({
        cod: String(fd.get("cod") ?? ""),
        denumire: String(fd.get("denumire") ?? ""),
        cod_cor: String(fd.get("cod_cor") ?? ""),
        nivel_studii: String(fd.get("nivel_studii") ?? ""),
        descriere: String(fd.get("descriere") ?? ""),
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
        className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-4 py-2 text-sm font-medium"
      >
        Funcție nouă
      </button>
    );
  }

  return (
    <form
      action={trimite}
      className="border-border grid gap-3 rounded-lg border p-4 sm:grid-cols-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idCod} className="text-sm font-medium">
          Cod intern *
        </label>
        <input
          id={idCod}
          name="cod"
          type="text"
          required
          maxLength={32}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idDenumire} className="text-sm font-medium">
          Denumire *
        </label>
        <input
          id={idDenumire}
          name="denumire"
          type="text"
          required
          maxLength={160}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idCodCor} className="text-sm font-medium">
          Cod COR (6 cifre)
        </label>
        <input
          id={idCodCor}
          name="cod_cor"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="251401"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idNivelStudii} className="text-sm font-medium">
          Nivel de studii
        </label>
        <input
          id={idNivelStudii}
          name="nivel_studii"
          type="text"
          maxLength={80}
          placeholder="Superioare"
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1 sm:col-span-2">
        <label htmlFor={idDescriere} className="text-sm font-medium">
          Descriere
        </label>
        <textarea
          id={idDescriere}
          name="descriere"
          maxLength={1000}
          rows={2}
          className="border-foreground/60 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={inCurs}
          className="bg-primary text-primary-foreground hover:bg-primary-hover disabled:border-border disabled:bg-surface disabled:text-muted-foreground rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed"
        >
          {inCurs ? "Se creează…" : "Creează funcția"}
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
