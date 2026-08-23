// src/app/(app)/puncte-lucru/actiuni-punct-lucru.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { JUDETE } from "@/schemas/organization";
import { actualizeazaPunctLucru, dezactiveazaPunctLucru } from "./actions";

interface Proprietati {
  readonly punct: Readonly<{
    id: string;
    denumire: string;
    adresa: string | null;
    judet: string | null;
    oras: string | null;
    cod_postal: string | null;
    sediu_principal: boolean;
    observatii: string | null;
  }>;
  readonly poateEdita: boolean;
}

export function ActiuniPunctLucru({ punct, poateEdita }: Proprietati) {
  const router = useRouter();
  const [editeaza, setEditeaza] = useState(false);
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idDenumire = useId();
  const idAdresa = useId();
  const idJudet = useId();
  const idOras = useId();
  const idCodPostal = useId();

  if (!poateEdita) return null;

  function trimiteEditare(fd: FormData): void {
    setEroare(null);
    porneste(async () => {
      const judet = String(fd.get("judet") ?? "");
      const rezultat = await actualizeazaPunctLucru({
        id: punct.id,
        denumire: String(fd.get("denumire") ?? ""),
        adresa: String(fd.get("adresa") ?? ""),
        judet: judet === "" ? null : judet,
        oras: String(fd.get("oras") ?? ""),
        cod_postal: String(fd.get("cod_postal") ?? ""),
        sediu_principal: fd.get("sediu_principal") === "on",
        observatii: punct.observatii,
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
      const rezultat = await dezactiveazaPunctLucru({ id: punct.id });
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
              defaultValue={punct.denumire}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idJudet} className="text-nota font-medium">
              Județ
            </label>
            <select
              id={idJudet}
              name="judet"
              defaultValue={punct.judet ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
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
            <label htmlFor={idOras} className="text-nota font-medium">
              Localitate
            </label>
            <input
              id={idOras}
              name="oras"
              type="text"
              maxLength={80}
              defaultValue={punct.oras ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={idCodPostal} className="text-nota font-medium">
              Cod poștal
            </label>
            <input
              id={idCodPostal}
              name="cod_postal"
              type="text"
              maxLength={10}
              defaultValue={punct.cod_postal ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={idAdresa} className="text-nota font-medium">
              Adresă
            </label>
            <input
              id={idAdresa}
              name="adresa"
              type="text"
              maxLength={240}
              defaultValue={punct.adresa ?? ""}
              className="border-foreground/60 rounded-control text-corp border px-2 py-1.5"
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id={`${idDenumire}-principal`}
              name="sediu_principal"
              type="checkbox"
              defaultChecked={punct.sediu_principal}
              className="border-border size-4 rounded"
            />
            <label htmlFor={`${idDenumire}-principal`} className="text-nota">
              Sediu principal
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
