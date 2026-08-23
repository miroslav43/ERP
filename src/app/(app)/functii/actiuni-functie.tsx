// src/app/(app)/functii/actiuni-functie.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil, Undo2 } from "lucide-react";

import { Buton } from "@/components/ui/buton";

import { actualizeazaFunctie, dezactiveazaFunctie, reactiveazaFunctie } from "./actions";

interface Proprietati {
  readonly functie: Readonly<{
    id: string;
    denumire: string;
    cod_cor: string | null;
    nivel_studii: string | null;
    descriere: string | null;
    activ: boolean;
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

  /** Vezi nota din `departamente/actiuni-departament.tsx`: dezactivarea e acum
   *  reversibilă, deci nu cere confirmare. */
  function comutaActivarea(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = functie.activ
        ? await dezactiveazaFunctie({ id: functie.id })
        : await reactiveazaFunctie({ id: functie.id });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-nota flex flex-wrap gap-1">
        <Buton
          varianta="tertiar"
          onClick={() => {
            setEditeaza((v) => !v);
          }}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editează
        </Buton>
        {functie.activ ? (
          <Buton varianta="distructiv" onClick={comutaActivarea} disabled={inCurs}>
            <Ban aria-hidden="true" className="size-3.5" />
            Dezactivează
          </Buton>
        ) : (
          <Buton varianta="secundar" onClick={comutaActivarea} disabled={inCurs}>
            <Undo2 aria-hidden="true" className="size-3.5" />
            Reactivează
          </Buton>
        )}
      </div>

      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota">
          {eroare}
        </p>
      )}

      {editeaza ? (
        <form
          action={trimiteEditare}
          className="border-border rounded-control grid gap-2 border p-3 sm:grid-cols-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={idDenumire} className="text-nota font-medium">
              Denumire
            </label>
            <input
              id={idDenumire}
              name="denumire"
              type="text"
              required
              maxLength={160}
              defaultValue={functie.denumire}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idCodCor} className="text-nota font-medium">
              Cod COR
            </label>
            <input
              id={idCodCor}
              name="cod_cor"
              type="text"
              inputMode="numeric"
              maxLength={6}
              defaultValue={functie.cod_cor ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idNivelStudii} className="text-nota font-medium">
              Nivel de studii
            </label>
            <input
              id={idNivelStudii}
              name="nivel_studii"
              type="text"
              maxLength={80}
              defaultValue={functie.nivel_studii ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={idDescriere} className="text-nota font-medium">
              Descriere
            </label>
            <textarea
              id={idDescriere}
              name="descriere"
              maxLength={1000}
              rows={2}
              defaultValue={functie.descriere ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Buton type="submit" varianta="primar" inCurs={inCurs} textInCurs="Se salvează…">
              Salvează
            </Buton>
          </div>
        </form>
      ) : null}
    </div>
  );
}
