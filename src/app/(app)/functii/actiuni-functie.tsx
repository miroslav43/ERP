// src/app/(app)/functii/actiuni-functie.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil } from "lucide-react";

import { actualizeazaFunctie, dezactiveazaFunctie } from "./actions";

interface Proprietati {
  readonly functie: Readonly<{
    id: string;
    denumire: string;
    cod_cor: string | null;
    nivel_studii: string | null;
    descriere: string | null;
  }>;
  readonly poateEdita: boolean;
}

export function ActiuniFunctie({ functie, poateEdita }: Proprietati) {
  const router = useRouter();
  const [editeaza, setEditeaza] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idDenumire = useId();
  const idCodCor = useId();
  const idNivelStudii = useId();
  const idDescriere = useId();

  if (!poateEdita) return null;

  function trimiteEditare(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await actualizeazaFunctie({
        id: functie.id,
        denumire: String(fd.get("denumire") ?? ""),
        cod_cor: String(fd.get("cod_cor") ?? ""),
        nivel_studii: String(fd.get("nivel_studii") ?? ""),
        descriere: String(fd.get("descriere") ?? ""),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setEditeaza(false);
      router.refresh();
    });
  }

  function dezactiveaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await dezactiveazaFunctie({ id: functie.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 text-xs">
        <button
          type="button"
          onClick={() => {
            setEditeaza((v) => !v);
          }}
          className="text-muted-foreground hover:bg-surface hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editează
        </button>
        <button
          type="button"
          onClick={dezactiveaza}
          disabled={inCurs}
          className="text-danger hover:bg-danger/8 inline-flex items-center gap-1.5 rounded-md px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Ban aria-hidden="true" className="size-3.5" />
          Dezactivează
        </button>
      </div>

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-xs">
          {eroare}
        </p>
      )}

      {editeaza ? (
        <form
          action={trimiteEditare}
          className="border-border grid gap-2 rounded-md border p-3 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={idDenumire} className="text-xs font-medium">
              Denumire
            </label>
            <input
              id={idDenumire}
              name="denumire"
              type="text"
              required
              maxLength={160}
              defaultValue={functie.denumire}
              className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idCodCor} className="text-xs font-medium">
              Cod COR
            </label>
            <input
              id={idCodCor}
              name="cod_cor"
              type="text"
              inputMode="numeric"
              maxLength={6}
              defaultValue={functie.cod_cor ?? ""}
              className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idNivelStudii} className="text-xs font-medium">
              Nivel de studii
            </label>
            <input
              id={idNivelStudii}
              name="nivel_studii"
              type="text"
              maxLength={80}
              defaultValue={functie.nivel_studii ?? ""}
              className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={idDescriere} className="text-xs font-medium">
              Descriere
            </label>
            <textarea
              id={idDescriere}
              name="descriere"
              maxLength={1000}
              rows={2}
              defaultValue={functie.descriere ?? ""}
              className="border-foreground/60 rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={inCurs}
              className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
            >
              {inCurs ? "Se salvează…" : "Salvează"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
