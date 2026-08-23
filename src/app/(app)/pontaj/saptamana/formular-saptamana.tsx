// src/app/(app)/pontaj/saptamana/formular-saptamana.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Tabel, type Coloana } from "@/components/ui/tabel";
import { TIPURI_PREZENTA, type TipPrezenta } from "@/schemas/attendance";
import { ETICHETE_TIP_PREZENTA } from "../etichete";
import { trimiteSaptamanaPontaj } from "./actions";

interface ZiFormular {
  readonly data: string;
  readonly tip_prezenta: TipPrezenta;
  readonly ore_planificate: string;
  readonly observatii: string;
}

interface Proprietati {
  readonly saptamanaStart: string;
  readonly zileInitiale: readonly ZiFormular[];
  readonly poateEdita: boolean;
}

const ETICHETE_ZI = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"] as const;

/** Eticheta zilei vine din poziție, deci indexul călătorește cu rândul. */
interface RandZi extends ZiFormular {
  readonly index: number;
}

export function FormularSaptamana({ saptamanaStart, zileInitiale, poateEdita }: Proprietati) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const [zile, setZile] = useState<readonly ZiFormular[]>(zileInitiale);
  const idBaza = useId();

  function actualizeazaZi(index: number, campuri: Partial<ZiFormular>): void {
    setZile((curent) => curent.map((zi, i) => (i === index ? { ...zi, ...campuri } : zi)));
  }

  function trimite(status: "ciorna" | "trimisa"): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await trimiteSaptamanaPontaj({
        saptamana_start: saptamanaStart,
        status,
        zile: zile.map((zi) => ({
          data: zi.data,
          tip_prezenta: zi.tip_prezenta,
          ore_planificate: Number(zi.ore_planificate),
          observatii: zi.observatii.length === 0 ? null : zi.observatii,
        })),
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      router.refresh();
    });
  }

  const randuri: readonly RandZi[] = zile.map((zi, index) => ({ ...zi, index }));

  const coloane: readonly Coloana<RandZi>[] = [
    {
      cheie: "zi",
      antet: "Zi",
      latime: "ingusta",
      peTelefon: "titlu",
      celula: (rand) => (
        <>
          {ETICHETE_ZI[rand.index]}
          <span className="text-muted-foreground ml-1.5 font-normal">
            {new Date(`${rand.data}T00:00:00Z`).toLocaleDateString("ro-RO", {
              day: "2-digit",
              month: "2-digit",
            })}
          </span>
        </>
      ),
    },
    {
      cheie: "tip_prezenta",
      antet: "Cum vin la lucru",
      peTelefon: "meta",
      celula: (rand) => (
        <select
          aria-label={`Mod de prezență — ${ETICHETE_ZI[rand.index]}`}
          value={rand.tip_prezenta}
          disabled={!poateEdita || inCurs}
          onChange={(e) => {
            actualizeazaZi(rand.index, { tip_prezenta: e.target.value as TipPrezenta });
          }}
          className="border-foreground/60 disabled:bg-surface rounded-control text-corp border px-2 py-1.5 disabled:cursor-not-allowed"
        >
          {TIPURI_PREZENTA.map((t) => (
            <option key={t} value={t}>
              {ETICHETE_TIP_PREZENTA[t]}
            </option>
          ))}
        </select>
      ),
    },
    {
      cheie: "ore_planificate",
      antet: "Ore planificate",
      numeric: true,
      peTelefon: "meta",
      celula: (rand) => (
        <input
          aria-label={`Ore planificate — ${ETICHETE_ZI[rand.index]}`}
          type="number"
          min={0}
          max={24}
          step={0.5}
          value={rand.ore_planificate}
          disabled={!poateEdita || inCurs}
          onChange={(e) => {
            actualizeazaZi(rand.index, { ore_planificate: e.target.value });
          }}
          className="border-foreground/60 disabled:bg-surface rounded-control text-corp w-20 border px-2 py-1.5 disabled:cursor-not-allowed"
        />
      ),
    },
    {
      cheie: "observatii",
      antet: "Observații",
      peTelefon: "meta",
      celula: (rand) => (
        <input
          aria-label={`Observații — ${ETICHETE_ZI[rand.index]}`}
          type="text"
          maxLength={500}
          value={rand.observatii}
          disabled={!poateEdita || inCurs}
          onChange={(e) => {
            actualizeazaZi(rand.index, { observatii: e.target.value });
          }}
          className="border-foreground/60 disabled:bg-surface rounded-control text-corp w-full min-w-32 border px-2 py-1.5 disabled:cursor-not-allowed"
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <Tabel
        caption="Planul de prezență pentru săptămâna selectată."
        coloane={coloane}
        randuri={randuri}
        cheieRand={(rand) => rand.data}
        densitate="compact"
        gol={null}
      />

      <div aria-live="polite">
        {eroare === null ? null : <p className="text-danger text-corp">{eroare}</p>}
      </div>

      {poateEdita ? (
        <div className="flex flex-wrap gap-2">
          <Buton
            varianta="secundar"
            disabled={inCurs}
            onClick={() => {
              trimite("ciorna");
            }}
            id={idBaza}
          >
            Salvează ciornă
          </Buton>
          <Buton
            varianta="primar"
            inCurs={inCurs}
            textInCurs="Se trimite…"
            onClick={() => {
              trimite("trimisa");
            }}
          >
            Trimite spre aprobare
          </Buton>
        </div>
      ) : null}
    </div>
  );
}
