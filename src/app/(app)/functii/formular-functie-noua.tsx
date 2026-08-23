// src/app/(app)/functii/formular-functie-noua.tsx
"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";

import { CautaCor } from "./cauta-cor";
import { creeazaFunctie } from "./actions";

/**
 * Funcție nouă.
 *
 * Formularul trece prin `<Formular>` + `<Camp>` pentru un defect măsurat, nu
 * pentru consecvență: cu `<form action={fn}>` și câmpuri necontrolate, React 19
 * RESETEAZĂ formularul după ce acțiunea se încheie — inclusiv când acțiunea a
 * eșuat. Aici asta însemna că un cod COR inexistent (singura validare care chiar
 * respinge des: `codCorOptional` cere ca cele șase cifre să EXISTE în
 * Clasificarea Ocupațiilor, nu doar să fie cifre) golea și codul intern, și
 * denumirea, și nivelul de studii, și descrierea. Patru câmpuri corecte
 * pierdute din cauza unuia greșit.
 *
 * `valoriTrimise` le pune înapoi ca `defaultValue`, iar `stare.erori` duce
 * fiecare mesaj lângă câmpul lui — serverul construia deja `fieldErrors`, iar
 * varianta veche le arunca și afișa un singur `<p>` roșu lângă buton.
 *
 * Identificatorii se prefixează cu `useId()`: pe aceeași pagină stau N
 * formulare de editare din `actiuni-functie.tsx`, cu exact aceleași nume de
 * câmp, iar `Camp` derivă `id` din `nume`.
 */

/** Cheile obiectului sunt EXACT cele din `creeazaFunctieSchema`. */
async function trimite(date: FormData) {
  return creeazaFunctie({
    cod: String(date.get("cod") ?? ""),
    denumire: String(date.get("denumire") ?? ""),
    cod_cor: String(date.get("cod_cor") ?? ""),
    nivel_studii: String(date.get("nivel_studii") ?? ""),
    descriere: String(date.get("descriere") ?? ""),
  });
}

export function FormularFunctieNoua() {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;

  // `useCallback`: `laReusita` intră în lista de dependențe a efectului din
  // `Formular`. O funcție nouă la fiecare randare ar reporni efectul după
  // succes, deci notificarea ar apărea de două ori.
  const laReusita = useCallback((): void => {
    setDeschis(false);
    router.refresh();
  }, [router]);

  if (!deschis) {
    return (
      <Buton
        varianta="primar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        Funcție nouă
      </Buton>
    );
  }

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita="Funcția a fost creată."
      className="border-border rounded-panou grid gap-3 border p-4 sm:grid-cols-2"
    >
      {(stare) => {
        const eroriCor = stare.erori["cod_cor"] ?? [];

        return (
          <>
            <Camp
              nume="cod"
              id={idc("cod")}
              eticheta="Cod intern"
              obligatoriu
              erori={stare.erori["cod"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="text"
                  maxLength={32}
                  defaultValue={stare.valoriTrimise["cod"] ?? ""}
                />
              )}
            </Camp>

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
                  defaultValue={stare.valoriTrimise["denumire"] ?? ""}
                />
              )}
            </Camp>

            {/* `CautaCor` își desenează propriul `<input name="cod_cor">`, cu
                stare proprie — de la `Camp` îi trebuie doar identificatorul și
                marcajul de invaliditate. */}
            <Camp
              nume="cod_cor"
              id={idc("cod_cor")}
              eticheta="Cod COR"
              ajutor="Necesar pentru contract și pentru exportul REVISAL."
              erori={eroriCor}
            >
              {(a) => (
                <CautaCor
                  idInput={a.id}
                  valoareInitiala={stare.valoriTrimise["cod_cor"] ?? ""}
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
                  placeholder="Superioare"
                  defaultValue={stare.valoriTrimise["nivel_studii"] ?? ""}
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
                  defaultValue={stare.valoriTrimise["descriere"] ?? ""}
                />
              )}
            </Camp>

            <div className="flex items-center gap-3 sm:col-span-2">
              <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se creează…">
                Creează funcția
              </Buton>
              <Buton
                varianta="link"
                disabled={stare.inCurs}
                onClick={() => {
                  setDeschis(false);
                }}
              >
                Renunță
              </Buton>
            </div>
          </>
        );
      }}
    </Formular>
  );
}
