// src/app/(app)/functii/campuri-functie.tsx
"use client";

import type { ReactElement } from "react";

import { Camp } from "@/components/ui/camp";

import { CautaCor } from "./cauta-cor";

/**
 * Câmpurile unei funcții, o singură dată.
 *
 * Erau scrise de două ori — în `formular-functie-noua.tsx` și în
 * `actiuni-functie.tsx` — cu aceleași etichete, aceleași lungimi maxime și
 * aceleași comentarii despre resetul de după acțiune al lui React 19. Singura
 * deosebire reală între cele două formulare e codul intern: se stabilește la
 * creare și nu se mai schimbă, fiindcă e cheia sub care funcția apare în
 * contracte și în exportul REVISAL.
 *
 * ── DE CE `stare` E TIPAT STRUCTURAL, NU CA `StareFormular<T>` ────────────
 * `StareFormular` e generic după tipul întors de acțiune — `{ id }` la creare,
 * tot `{ id }` la actualizare, dar nimic nu garantează că rămâne așa. Câmpurile
 * nu citesc `data`, deci nu au de ce să depindă de el: cer exact cele două
 * bucăți pe care le folosesc, iar orice `StareFormular<T>` le satisface.
 */
export type StareCampuri = Readonly<{
  erori: Readonly<Record<string, readonly string[]>>;
  /**
   * Ce s-a trimis ultima dată. Se pune ca `defaultValue`, altfel un refuz de
   * validare — cel mai des un cod COR inexistent — ar goli și celelalte patru
   * câmpuri, corect completate.
   */
  valoriTrimise: Readonly<Record<string, string>>;
}>;

export type ValoriFunctie = Readonly<{
  denumire: string;
  cod_cor: string | null;
  nivel_studii: string | null;
  descriere: string | null;
}>;

export const VALORI_GOALE: ValoriFunctie = {
  denumire: "",
  cod_cor: null,
  nivel_studii: null,
  descriere: null,
};

export function CampuriFunctie({
  stare,
  idc,
  initiale,
  cuCodIntern,
}: Readonly<{
  stare: StareCampuri;
  /**
   * Prefixează identificatorii câmpurilor. Pe pagină stau N formulare de
   * editare cu ACELEAȘI nume de câmp, iar `Camp` derivă `id` din `nume` — fără
   * prefix, fiecare `<label>` ar arăta către primul câmp omonim din DOM.
   */
  idc: (sufix: string) => string;
  initiale: ValoriFunctie;
  /** Codul intern apare doar la creare: pe urmă e cheia funcției. */
  cuCodIntern: boolean;
}>): ReactElement {
  const eroriCor = stare.erori["cod_cor"] ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cuCodIntern ? (
        <Camp
          nume="cod"
          id={idc("cod")}
          eticheta="Cod intern"
          ajutor="Cum apare funcția în listele interne. Nu se mai poate schimba după creare."
          obligatoriu
          erori={stare.erori["cod"] ?? []}
        >
          {(a) => (
            <input
              {...a}
              type="text"
              maxLength={32}
              placeholder="Ex. F-014"
              defaultValue={stare.valoriTrimise["cod"] ?? ""}
            />
          )}
        </Camp>
      ) : null}

      <Camp
        nume="denumire"
        id={idc("denumire")}
        eticheta="Denumire"
        obligatoriu
        // Spread, nu `className={… ? undefined : …}`: `exactOptionalPropertyTypes`
        // face diferența dintre „proprietate absentă" și „proprietate cu valoarea
        // `undefined`", iar `PropsCamp.className` o acceptă doar pe prima.
        {...(cuCodIntern ? {} : { className: "sm:col-span-2" })}
        erori={stare.erori["denumire"] ?? []}
      >
        {(a) => (
          <input
            {...a}
            type="text"
            maxLength={160}
            placeholder="Ex. Șofer de autoturisme"
            defaultValue={stare.valoriTrimise["denumire"] ?? initiale.denumire}
          />
        )}
      </Camp>

      {/* `CautaCor` își desenează propriul `<input name="cod_cor">`, cu stare
          proprie — de la `Camp` îi trebuie doar identificatorul și marcajul de
          invaliditate. Ocupă toată lățimea: lista de rezultate are nevoie de loc
          pentru denumiri de felul „proiectant inginer de sisteme și calculatoare”. */}
      <Camp
        nume="cod_cor"
        id={idc("cod_cor")}
        eticheta="Cod COR"
        ajutor="Necesar pentru contractul individual de muncă și pentru exportul REVISAL."
        className="sm:col-span-2"
        erori={eroriCor}
      >
        {(a) => (
          <CautaCor
            idInput={a.id}
            valoareInitiala={stare.valoriTrimise["cod_cor"] ?? initiale.cod_cor ?? ""}
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
            placeholder="Ex. Superioare"
            defaultValue={stare.valoriTrimise["nivel_studii"] ?? initiale.nivel_studii ?? ""}
          />
        )}
      </Camp>

      <Camp
        nume="descriere"
        id={idc("descriere")}
        eticheta="Descriere"
        fel="textarea"
        erori={stare.erori["descriere"] ?? []}
      >
        {(a) => (
          <textarea
            {...a}
            maxLength={1000}
            rows={3}
            placeholder="Atribuții principale, dacă e util să fie scrise aici."
            defaultValue={stare.valoriTrimise["descriere"] ?? initiale.descriere ?? ""}
          />
        )}
      </Camp>
    </div>
  );
}
