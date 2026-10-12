"use client";

import { useId, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { clasaControl } from "@/components/ui/camp";
import { arataToast } from "@/components/ui/toast";

import { legaDeplasarea } from "../../actions-soferi";

/**
 * Selectorul „Deplasarea (delegația)” de pe ciorna foii (0204, F9). Lista e
 * citită pe server (deplasările șoferului din jurul zilei foii, fără cele
 * anulate); baza refuză oricum deplasarea altui om sau a altei firme
 * (`internal.foi_deplasare_garda`), iar refuzul ajunge sub selector.
 */
export interface OptiuneLegatura {
  readonly id: string;
  readonly eticheta: string;
}

interface Proprietati {
  readonly foaieId: string;
  readonly legataId: string | null;
  readonly optiuni: readonly OptiuneLegatura[];
}

export function LegaturaDeplasare({ foaieId, legataId, optiuni }: Proprietati): ReactElement {
  const router = useRouter();
  const idSelect = useId();
  const idEroare = useId();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);

  function trimite(date: FormData): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await legaDeplasarea({
        id: foaieId,
        business_trip_id: String(date.get("business_trip_id") ?? ""),
      });
      if (!rezultat.ok) {
        const pe = rezultat.error.fieldErrors?.["business_trip_id"]?.[0];
        setEroare(pe ?? rezultat.error.message);
        return;
      }
      arataToast({ fel: "reusita", text: "Legătura cu deplasarea a fost salvată." });
      router.refresh();
    });
  }

  return (
    <form action={trimite} className="flex flex-wrap items-end gap-2">
      <div className="flex min-w-0 flex-1 flex-col">
        <label htmlFor={idSelect} className="text-foreground text-corp mb-1 font-medium">
          Deplasarea (delegația) pe care o justifică foaia
        </label>
        <select
          id={idSelect}
          name="business_trip_id"
          defaultValue={legataId ?? ""}
          className={clasaControl({ fel: "select" })}
          aria-invalid={eroare === null ? undefined : true}
          aria-describedby={eroare === null ? undefined : idEroare}
        >
          <option value="">Fără deplasare</option>
          {optiuni.map((o) => (
            <option key={o.id} value={o.id}>
              {o.eticheta}
            </option>
          ))}
        </select>
      </div>
      <Buton type="submit" varianta="secundar" disabled={inCurs}>
        {inCurs ? "Se salvează…" : "Salvează legătura"}
      </Buton>
      {eroare === null ? null : (
        <p id={idEroare} role="alert" className="text-danger text-nota basis-full">
          {eroare}
        </p>
      )}
    </form>
  );
}
