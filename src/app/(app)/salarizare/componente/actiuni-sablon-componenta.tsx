// src/app/(app)/salarizare/componente/actiuni-sablon-componenta.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil } from "lucide-react";

import { Buton } from "@/components/ui/buton";

import { actualizeazaSablonComponenta, dezactiveazaSablonComponenta } from "./actions";

interface Proprietati {
  readonly sablon: Readonly<{
    id: string;
    denumire: string;
    impozabil: boolean;
    intra_in_baza_cas: boolean;
    intra_in_baza_cass: boolean;
    cod_revisal: string | null;
  }>;
  readonly poateEdita: boolean;
}

export function ActiuniSablonComponenta({ sablon, poateEdita }: Proprietati) {
  const router = useRouter();
  const [editeaza, setEditeaza] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idDenumire = useId();
  const idCodRevisal = useId();

  if (!poateEdita) return null;

  function trimiteEditare(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await actualizeazaSablonComponenta({
        id: sablon.id,
        denumire: String(fd.get("denumire") ?? ""),
        cod_revisal: String(fd.get("cod_revisal") ?? ""),
        impozabil: fd.get("impozabil") === "on",
        intra_in_baza_cas: fd.get("intra_in_baza_cas") === "on",
        intra_in_baza_cass: fd.get("intra_in_baza_cass") === "on",
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
      const rezultat = await dezactiveazaSablonComponenta({ id: sablon.id });
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
        <Buton varianta="distructiv" onClick={dezactiveaza} disabled={inCurs}>
          <Ban aria-hidden="true" className="size-3.5" />
          Dezactivează
        </Buton>
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
              defaultValue={sablon.denumire}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idCodRevisal} className="text-nota font-medium">
              Cod REVISAL
            </label>
            <input
              id={idCodRevisal}
              name="cod_revisal"
              type="text"
              maxLength={40}
              defaultValue={sablon.cod_revisal ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <label className="text-nota flex items-center gap-1.5">
              <input
                name="impozabil"
                type="checkbox"
                defaultChecked={sablon.impozabil}
                className="border-border size-4 rounded"
              />
              Impozabil
            </label>
            <label className="text-nota flex items-center gap-1.5">
              <input
                name="intra_in_baza_cas"
                type="checkbox"
                defaultChecked={sablon.intra_in_baza_cas}
                className="border-border size-4 rounded"
              />
              Intră în baza CAS
            </label>
            <label className="text-nota flex items-center gap-1.5">
              <input
                name="intra_in_baza_cass"
                type="checkbox"
                defaultChecked={sablon.intra_in_baza_cass}
                className="border-border size-4 rounded"
              />
              Intră în baza CASS
            </label>
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
