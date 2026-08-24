// src/app/(app)/functii/actiuni-functie.tsx
"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil, Undo2 } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";

import { CautaCor } from "./cauta-cor";
import { actualizeazaFunctie, dezactiveazaFunctie, reactiveazaFunctie } from "./actions";

/**
 * Acțiunile unui rând din nomenclatorul de funcții: editarea și comutarea
 * activării.
 *
 * Numai editarea trece prin `<Formular>` — ea are câmpuri, deci și `fieldErrors`
 * de arătat pe câmp, și date de pierdut la resetul de după acțiune al lui React
 * 19. Comutarea activării n-are decât `id`, luat din props; acolo
 * `useTransition` și un mesaj sub butoane spun tot ce e de spus.
 *
 * Ce se pierdea înainte, concret: `codCorOptional` respinge un cod care nu
 * există în Clasificarea Ocupațiilor (nu doar unul cu alt număr de cifre). La
 * refuz, formularul necontrolat se reseta, deci denumirea, nivelul de studii și
 * descrierea rescrise se întorceau la valorile din bază — fără niciun semn că
 * s-a pierdut ceva.
 */

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
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  // `useCallback`: `laReusita` intră în dependențele efectului din `Formular`;
  // o funcție nouă la fiecare randare ar scoate notificarea de două ori.
  const laReusita = useCallback((): void => {
    setEditeaza(false);
    router.refresh();
  }, [router]);

  if (!poateEdita) return null;

  /** Cheile obiectului sunt EXACT cele din `actualizeazaFunctieSchema`. */
  async function trimiteEditare(date: FormData) {
    return actualizeazaFunctie({
      id: functie.id,
      denumire: String(date.get("denumire") ?? ""),
      cod_cor: String(date.get("cod_cor") ?? ""),
      nivel_studii: String(date.get("nivel_studii") ?? ""),
      descriere: String(date.get("descriere") ?? ""),
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
        <Formular
          actiune={trimiteEditare}
          laReusita={laReusita}
          mesajReusita="Funcția a fost salvată."
          className="border-border rounded-control grid gap-2 border p-3 sm:grid-cols-2"
        >
          {(stare) => {
            const eroriCor = stare.erori["cod_cor"] ?? [];

            return (
              <>
                <Camp
                  nume="denumire"
                  id={idc("denumire")}
                  eticheta="Denumire"
                  obligatoriu
                  erori={stare.erori["denumire"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      maxLength={160}
                      defaultValue={stare.valoriTrimise["denumire"] ?? functie.denumire}
                    />
                  )}
                </Camp>

                <Camp nume="cod_cor" id={idc("cod_cor")} eticheta="Cod COR" erori={eroriCor}>
                  {(a) => (
                    <CautaCor
                      idInput={a.id}
                      valoareInitiala={stare.valoriTrimise["cod_cor"] ?? functie.cod_cor ?? ""}
                      invalid={eroriCor.length > 0}
                      descrisDe={a["aria-describedby"]}
                    />
                  )}
                </Camp>

                <Camp
                  nume="nivel_studii"
                  id={idc("nivel_studii")}
                  eticheta="Nivel de studii"
                  erori={stare.erori["nivel_studii"] ?? []}
                >
                  {(a) => (
                    <input
                      {...a}
                      type="text"
                      maxLength={80}
                      defaultValue={
                        stare.valoriTrimise["nivel_studii"] ?? functie.nivel_studii ?? ""
                      }
                    />
                  )}
                </Camp>

                <Camp
                  nume="descriere"
                  id={idc("descriere")}
                  eticheta="Descriere"
                  fel="textarea"
                  className="sm:col-span-2"
                  erori={stare.erori["descriere"] ?? []}
                >
                  {(a) => (
                    <textarea
                      {...a}
                      maxLength={1000}
                      rows={2}
                      defaultValue={stare.valoriTrimise["descriere"] ?? functie.descriere ?? ""}
                    />
                  )}
                </Camp>

                <div className="sm:col-span-2">
                  <Buton
                    type="submit"
                    varianta="primar"
                    inCurs={stare.inCurs}
                    textInCurs="Se salvează…"
                  >
                    Salvează
                  </Buton>
                </div>
              </>
            );
          }}
        </Formular>
      ) : null}
    </div>
  );
}
