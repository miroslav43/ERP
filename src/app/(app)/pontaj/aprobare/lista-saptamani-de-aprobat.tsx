// src/app/(app)/pontaj/aprobare/lista-saptamani-de-aprobat.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { ETICHETE_TIP_PREZENTA } from "../etichete";
import { decideSaptamanaPontaj } from "../saptamana/actions";
import type { SarcinaSaptamanaDeAprobat } from "@/lib/queries/attendance";

interface Proprietati {
  readonly sarcini: readonly SarcinaSaptamanaDeAprobat[];
}

const ETICHETE_ZI = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"] as const;

function RandSarcina({ sarcina }: { readonly sarcina: SarcinaSaptamanaDeAprobat }) {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [respingere, setRespingere] = useState(false);
  const [motiv, setMotiv] = useState("");
  const [eroare, setEroare] = useState<string | null>(null);
  const idMotiv = useId();

  function decide(decizie: "aprobata" | "respinsa"): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await decideSaptamanaPontaj({
        taskId: sarcina.taskId,
        decizie,
        motivRespingere: decizie === "respinsa" ? motiv : null,
      });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setRespingere(false);
      router.refresh();
    });
  }

  return (
    <li className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{sarcina.angajat?.fullName ?? "Angajat necunoscut"}</p>
          <p className="text-xs text-muted-foreground">
            Săptămâna din{" "}
            {new Date(`${sarcina.submisie.saptamanaStart}T00:00:00Z`).toLocaleDateString("ro-RO")}
          </p>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        {sarcina.zile.map((zi, index) => (
          <li key={zi.data} className="flex justify-between gap-2 text-muted-foreground">
            <span>{ETICHETE_ZI[index]}</span>
            <span className="text-foreground">
              {ETICHETE_TIP_PREZENTA[zi.tip_prezenta]} · {zi.ore_planificate}h
            </span>
          </li>
        ))}
      </ul>

      <div aria-live="polite">
        {eroare === null ? null : <p className="text-sm text-danger">{eroare}</p>}
      </div>

      {respingere ? (
        <div className="space-y-2">
          <label htmlFor={idMotiv} className="block text-sm font-medium">
            Motivul respingerii
          </label>
          <textarea
            id={idMotiv}
            rows={2}
            maxLength={500}
            value={motiv}
            onChange={(e) => {
              setMotiv(e.target.value);
            }}
            className="w-full rounded-md border border-foreground/60 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={inCurs || motiv.trim().length < 5}
              onClick={() => {
                decide("respinsa");
              }}
              className="rounded-md border border-danger px-3 py-1.5 text-sm text-danger hover:bg-danger hover:text-danger-foreground disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
            >
              Confirmă respingerea
            </button>
            <button
              type="button"
              onClick={() => {
                setRespingere(false);
              }}
              className="rounded-md border border-foreground/60 px-3 py-1.5 text-sm"
            >
              Renunță
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={inCurs}
            onClick={() => {
              decide("aprobata");
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted-foreground"
          >
            Aprobă săptămâna
          </button>
          <button
            type="button"
            disabled={inCurs}
            onClick={() => {
              setRespingere(true);
            }}
            className="rounded-md border border-danger px-4 py-2 text-sm text-danger hover:bg-danger hover:text-danger-foreground disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground"
          >
            Respinge
          </button>
        </div>
      )}
    </li>
  );
}

export function ListaSaptamaniDeAprobat({ sarcini }: Proprietati) {
  if (sarcini.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">Planuri săptămânale de aprobat</h2>
      <ul className="space-y-3">
        {sarcini.map((sarcina) => (
          <RandSarcina key={sarcina.taskId} sarcina={sarcina} />
        ))}
      </ul>
    </div>
  );
}
