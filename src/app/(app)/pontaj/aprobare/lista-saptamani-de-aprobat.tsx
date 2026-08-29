// src/app/(app)/pontaj/aprobare/lista-saptamani-de-aprobat.tsx
"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { formatOraZi, formatOre } from "@/lib/format/ore";

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
    <li className="border-border rounded-panou space-y-3 border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{sarcina.angajat?.fullName ?? "Angajat necunoscut"}</p>
          <p className="text-muted-foreground text-nota">
            Săptămâna din{" "}
            {new Date(`${sarcina.submisie.saptamanaStart}T00:00:00Z`).toLocaleDateString("ro-RO")}
          </p>
        </div>
      </div>

      <ul className="text-corp grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        {sarcina.zile.map((zi, index) => (
          <li key={zi.data} className="text-muted-foreground flex justify-between gap-2">
            <span>{ETICHETE_ZI[index]}</span>
            {/* Intervalul, nu doar totalul: aprobatorul decide dacă programul
                declarat e cel convenit, iar „8h" nu spune dacă omul vine la
                07:00 sau la 11:00. Zilele fără interval (weekend nebifat,
                sărbătoare) rămân doar cu ora zero. */}
            <span className="text-foreground tabular-nums">
              {ETICHETE_TIP_PREZENTA[zi.tip_prezenta]}
              {zi.ora_inceput === null || zi.ora_sfarsit === null
                ? ""
                : ` · ${formatOraZi(zi.ora_inceput) ?? ""}–${formatOraZi(zi.ora_sfarsit) ?? ""}`}{" "}
              · {formatOre(zi.ore_planificate)} h
            </span>
          </li>
        ))}
      </ul>

      <div aria-live="polite">
        {eroare === null ? null : <p className="text-danger text-corp">{eroare}</p>}
      </div>

      {respingere ? (
        <div className="space-y-2">
          <label htmlFor={idMotiv} className="text-corp block font-medium">
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
            className="border-foreground/60 rounded-control text-corp w-full border px-3 py-2"
          />
          <div className="flex gap-2">
            <Buton
              varianta="distructiv"
              disabled={inCurs || motiv.trim().length < 5}
              onClick={() => {
                decide("respinsa");
              }}
            >
              Confirmă respingerea
            </Buton>
            <Buton
              varianta="secundar"
              onClick={() => {
                setRespingere(false);
              }}
            >
              Renunță
            </Buton>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Buton
            varianta="primar"
            disabled={inCurs}
            onClick={() => {
              decide("aprobata");
            }}
          >
            Aprobă săptămâna
          </Buton>
          <Buton
            varianta="distructiv"
            disabled={inCurs}
            onClick={() => {
              setRespingere(true);
            }}
          >
            Respinge
          </Buton>
        </div>
      )}
    </li>
  );
}

export function ListaSaptamaniDeAprobat({ sarcini }: Proprietati) {
  if (sarcini.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sectiune font-semibold">Planuri săptămânale de aprobat</h2>
      <ul className="space-y-3">
        {sarcini.map((sarcina) => (
          <RandSarcina key={sarcina.taskId} sarcina={sarcina} />
        ))}
      </ul>
    </div>
  );
}
