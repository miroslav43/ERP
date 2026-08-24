"use client";

import { useEffect, useState } from "react";

import { Buton } from "@/components/ui/buton";

import { marcheazaAnuntCitit } from "../actions";

type Stare = "in_curs" | "confirmat" | "esuat";

type Rezultat = Awaited<ReturnType<typeof marcheazaAnuntCitit>>;

/**
 * Marchează automat, o singură dată la deschiderea paginii — fără buton, fără
 * clic. Acțiunea e idempotentă (verifică rândul existent înainte de a insera),
 * deci reîncărcarea paginii nu produce confirmări duplicate.
 *
 * Eșecul se ARATĂ. Înainte, un refuz al acțiunii lăsa componenta să nu randeze
 * nimic — exact ce randează și cât timp așteaptă răspunsul — iar angajatul
 * pleca de pe pagină convins că a confirmat, în timp ce ecranul administratorului
 * îl trecea la necitit. O confirmare de luare la cunoștință care poate eșua în
 * tăcere e mai rea decât una care lipsește: prima e o dovadă falsă.
 */
export function MarcheazaCitit({ id }: { readonly id: string }) {
  const [stare, setStare] = useState<Stare>("in_curs");
  const [motiv, setMotiv] = useState<string | null>(null);

  useEffect(() => {
    let anulat = false;
    // Scrierea pleacă din efect, dar starea se atinge doar în callback: un
    // `setState` sincron în corpul efectului declanșează randări în cascadă
    // (regula `react-hooks/set-state-in-effect`).
    void marcheazaAnuntCitit({ id }).then((rezultat: Rezultat) => {
      if (anulat) return;
      if (rezultat.ok) {
        setStare("confirmat");
        setMotiv(null);
        return;
      }
      setStare("esuat");
      setMotiv(rezultat.error.message);
    });
    return () => {
      anulat = true;
    };
  }, [id]);

  if (stare === "in_curs") return null;

  if (stare === "confirmat") {
    return (
      <p role="status" className="text-muted-foreground text-nota">
        Confirmat citit.
      </p>
    );
  }

  return (
    <div role="alert" className="flex flex-wrap items-center gap-3">
      <p className="text-danger text-corp">
        Confirmarea de citire nu a fost înregistrată{motiv === null ? "." : `: ${motiv}`} Anunțul
        rămâne trecut ca necitit până când reușește.
      </p>
      <Buton
        varianta="secundar"
        onClick={() => {
          setStare("in_curs");
          void marcheazaAnuntCitit({ id }).then((rezultat: Rezultat) => {
            if (rezultat.ok) {
              setStare("confirmat");
              setMotiv(null);
              return;
            }
            setStare("esuat");
            setMotiv(rezultat.error.message);
          });
        }}
      >
        Încearcă din nou
      </Buton>
    </div>
  );
}
