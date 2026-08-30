"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Rotita } from "@/components/incarcare/rotita";
import { ROLURI, etichetaRol } from "@/lib/membri/etichete";

import { schimbaRolulAngajatului } from "./actions";

/**
 * Rolul omului, schimbat de pe fișa lui.
 *
 * ── DE CE SELECTUL E NECONTROLAT, DAR SE DĂ ÎNAPOI LA REFUZ ───────────────
 * Schimbarea se comite pe `onChange`, fără buton de confirmare — la fel ca în
 * ecranul de membri. Atât timp cât rămâne așa, REFUZUL trebuie să dea înapoi și
 * controlul: altfel pe ecran rămâne afișat rolul RESPINS, iar omul pleacă
 * convins că l-a schimbat. Se rescrie `control.value` la valoarea pe care o are
 * baza, nu la ce a ales.
 *
 * ── DE CE SE ARATĂ ȘI CÂND NU SE POATE APĂSA ──────────────────────────────
 * Un `hr` care deschide fișa vede rolul și motivul pentru care nu-l poate
 * schimba. Ascunderea completă ar lăsa aceeași întrebare fără răspuns — „unde se
 * schimbă rolul?" — care e chiar întrebarea care a produs ecranul ăsta.
 */
export function SelectorRol({
  memberId,
  rolCurent,
  numePersoana,
  poateSchimba,
}: {
  readonly memberId: string;
  readonly rolCurent: string;
  readonly numePersoana: string;
  readonly poateSchimba: boolean;
}) {
  const router = useRouter();
  const [mesaj, setMesaj] = useState<Readonly<{ text: string; esteEroare: boolean }> | null>(null);
  const [inLucru, setInLucru] = useState(false);
  const [, porneste] = useTransition();
  const idSelect = useId();

  function schimba(control: HTMLSelectElement): void {
    const rolCerut = control.value;
    if (rolCerut === rolCurent) return;

    setMesaj(null);
    setInLucru(true);
    porneste(async () => {
      const rezultat = await schimbaRolulAngajatului({
        memberId,
        role: rolCerut as (typeof ROLURI)[number]["valoare"],
      });
      setInLucru(false);

      if (rezultat.ok) {
        setMesaj({
          text: `${numePersoana} are acum rolul ${etichetaRol(rolCerut)}.`,
          esteEroare: false,
        });
        // Matricea de mai jos arată implicitul ROLULUI: după schimbare e alta.
        router.refresh();
        return;
      }

      control.value = rolCurent;
      setMesaj({
        text: `${rezultat.error?.message ?? "Rolul nu a putut fi schimbat."} ${numePersoana} rămâne ${etichetaRol(rolCurent)}.`,
        esteEroare: true,
      });
    });
  }

  return (
    <div className="border-border bg-surface rounded-panou space-y-3 border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={idSelect} className="text-corp font-medium">
          Rol în aplicație
        </label>
        {poateSchimba ? (
          <select
            id={idSelect}
            defaultValue={rolCurent}
            disabled={inLucru}
            onChange={(eveniment) => schimba(eveniment.currentTarget)}
            className="border-border bg-background text-foreground rounded-control text-corp h-9 border px-2"
          >
            {ROLURI.map((rol) => (
              <option key={rol.valoare} value={rol.valoare}>
                {rol.eticheta}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-corp font-medium">{etichetaRol(rolCurent)}</span>
        )}
        {inLucru ? <Rotita /> : null}
      </div>

      <p className="text-muted-foreground text-corp">
        {poateSchimba
          ? "Rolul dă drepturile implicite. Suprascrierile de mai jos se adaugă peste el și rămân fixe chiar dacă rolul se schimbă."
          : "Rolul poate fi schimbat doar de un administrator al organizației — baza refuză scrierea oricui altcuiva. Cere-i unui administrator dacă e nevoie."}
      </p>

      {mesaj !== null ? (
        <p
          role="status"
          className={`text-corp ${mesaj.esteEroare ? "text-destructive" : "text-muted-foreground"}`}
        >
          {mesaj.text}
        </p>
      ) : null}
    </div>
  );
}
