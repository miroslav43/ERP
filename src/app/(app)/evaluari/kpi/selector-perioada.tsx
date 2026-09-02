"use client";

// src/app/(app)/evaluari/kpi/selector-perioada.tsx

/**
 * Alegerea lunii afișate.
 *
 * Navighează, nu filtrează în memorie: luna e în URL, deci un link către
 * „februarie 2026" se poate trimite pe chat, iar butonul înapoi al browserului
 * face ce se așteaptă. Un `useState` ar fi pierdut ambele.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { clasaControl } from "@/components/ui/camp";

import { LUNI_RO, numeLuna } from "./etichete";

/** Anii oferiți: cel curent, doi în urmă, unul înainte. Nimeni nu evaluează 2019. */
function aniPosibili(anCurent: number): readonly number[] {
  const acum = new Date().getFullYear();
  const set = new Set([anCurent, acum - 2, acum - 1, acum, acum + 1]);
  return [...set].sort((a, b) => b - a);
}

export function SelectorPerioada({
  an,
  luna,
}: Readonly<{ an: number; luna: number }>): ReactElement {
  const router = useRouter();
  const idLuna = useId();
  const idAn = useId();

  const mergiLa = (anNou: number, lunaNoua: number) => {
    router.push(`/evaluari/kpi?an=${String(anNou)}&luna=${String(lunaNoua)}`);
  };

  // Trecerea peste granița de an, ca să nu fie nevoie de două selectoare atinse.
  const inapoi = () => {
    if (luna === 1) mergiLa(an - 1, 12);
    else mergiLa(an, luna - 1);
  };
  const inainte = () => {
    if (luna === 12) mergiLa(an + 1, 1);
    else mergiLa(an, luna + 1);
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Buton marime="iconita" aria-label="Luna precedentă" onClick={inapoi}>
        <ChevronLeft className="size-4" />
      </Buton>

      <div className="flex flex-col gap-1">
        <label htmlFor={idLuna} className="text-eticheta text-muted-foreground font-medium">
          Luna
        </label>
        <select
          id={idLuna}
          className={clasaControl({ fel: "select" })}
          value={String(luna)}
          onChange={(e) => {
            mergiLa(an, Number.parseInt(e.target.value, 10));
          }}
        >
          {LUNI_RO.map((nume, i) => (
            <option key={nume} value={String(i + 1)}>
              {nume}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={idAn} className="text-eticheta text-muted-foreground font-medium">
          Anul
        </label>
        <select
          id={idAn}
          className={clasaControl({ fel: "select" })}
          value={String(an)}
          onChange={(e) => {
            mergiLa(Number.parseInt(e.target.value, 10), luna);
          }}
        >
          {aniPosibili(an).map((a) => (
            <option key={a} value={String(a)}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <Buton marime="iconita" aria-label="Luna următoare" onClick={inainte}>
        <ChevronRight className="size-4" />
      </Buton>

      <p className="text-muted-foreground text-nota self-center">Se arată {numeLuna(an, luna)}.</p>
    </div>
  );
}
