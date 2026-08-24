// src/app/(app)/functii/actiuni-functie.tsx
"use client";

import { useCallback, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Pencil, Undo2 } from "lucide-react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Dialog } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";

import { CampuriFunctie } from "./campuri-functie";
import { actualizeazaFunctie, dezactiveazaFunctie, reactiveazaFunctie } from "./actions";

/**
 * Acțiunile unui rând din nomenclator: editarea și comutarea activării.
 *
 * ── DE CE DEZACTIVAREA E BLOCATĂ ÎNAINTE DE CLIC, NU DUPĂ ─────────────────
 * `dezactiveazaFunctie` numără angajații alocați și refuză cu „Funcția are
 * angajați alocați. Mutați-i pe altă funcție înainte de dezactivare.” Refuzul e
 * corect, dar sosea DUPĂ apăsare: omul afla că nu se poate abia după ce
 * încercase, iar cifra care explică refuzul — câți angajați — nu apărea nicăieri.
 *
 * Acum numărul e deja în rând, deci butonul se poate opri singur și poate spune
 * de ce. Precondiția din `actions.ts` NU dispare: ea rămâne adevărul, fiindcă
 * între citirea paginii și apăsare altcineva poate muta un angajat pe funcție.
 * Ecranul doar nu mai lasă refuzul să fie o surpriză.
 *
 * `numarAngajati === null` înseamnă „nu s-a numărat”, nu „zero”: acolo butonul
 * rămâne deschis și decide serverul. Vezi nota din `queries/job-positions.ts` —
 * cine n-are `employees:read = all` n-ar număra decât o parte.
 *
 * ── CE PĂSTREAZĂ DIN VARIANTA VECHE ───────────────────────────────────────
 * Numai editarea trece prin `<Formular>`: ea are câmpuri, deci și `fieldErrors`
 * de arătat pe câmp, și date de pierdut la resetul de după acțiune al lui React
 * 19 — `codCorOptional` respinge un cod care nu există în Clasificarea
 * Ocupațiilor, iar la refuz denumirea și descrierea rescrise se întorceau la
 * valorile din bază, fără niciun semn că s-a pierdut ceva. Comutarea activării
 * n-are decât `id`; acolo `useTransition` și un mesaj sub butoane spun tot.
 */

interface Proprietati {
  readonly functie: Readonly<{
    id: string;
    denumire: string;
    cod_cor: string | null;
    nivel_studii: string | null;
    descriere: string | null;
    activ: boolean;
    numarAngajati: number | null;
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

  const inchide = useCallback((): void => {
    setEditeaza(false);
  }, []);

  if (!poateEdita) return null;

  const ocupata = functie.numarAngajati !== null && functie.numarAngajati > 0;

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

  /** Vezi nota din `departamente/actiuni-departament.tsx`: dezactivarea e
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
    // Numai `<span>`-uri, cu `display` schimbat din clase. `pontaj/perioade`
    // alesese slotul de „insignă" tocmai fiindcă randează un `<div>`, care în
    // rândul mărunt al cardului (un `<p>`) ar fi închis paragraful devreme și ar
    // fi rupt hidratarea. Slotul de insignă e însă tot un `<span>`, deci un
    // `<div>` rămâne conținut invalid și acolo — doar unul pe care browserul îl
    // tolerează. Aici nu e nevoie nici de toleranța aia.
    <span className="flex flex-col items-start gap-1">
      <span className="flex flex-wrap items-center gap-1">
        <Buton
          varianta="tertiar"
          onClick={() => {
            setEditeaza(true);
          }}
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editează
          <span className="sr-only"> funcția {functie.denumire}</span>
        </Buton>

        {functie.activ ? (
          <Buton
            varianta="distructiv"
            onClick={comutaActivarea}
            disabled={inCurs || ocupata}
            // Motivul refuzului stă pe buton, nu doar în mesajul de după clic:
            // un buton blocat fără explicație e la fel de opac ca unul care
            // eșuează.
            title={
              ocupata ? `Funcția are ${String(functie.numarAngajati)} angajați alocați.` : undefined
            }
          >
            <Ban aria-hidden="true" className="size-3.5" />
            Dezactivează
            <span className="sr-only"> funcția {functie.denumire}</span>
          </Buton>
        ) : (
          <Buton varianta="secundar" onClick={comutaActivarea} disabled={inCurs}>
            <Undo2 aria-hidden="true" className="size-3.5" />
            Reactivează
            <span className="sr-only"> funcția {functie.denumire}</span>
          </Buton>
        )}
      </span>

      {/* Explicația însoțește butonul blocat. `aria-describedby` ar fi cerut ca
          textul să existe și când butonul e liber; aici apare doar când chiar
          există o piedică. */}
      {ocupata && functie.activ ? (
        <span className="text-muted-foreground text-nota block">
          Nu se poate dezactiva: are {functie.numarAngajati}{" "}
          {functie.numarAngajati === 1 ? "angajat alocat" : "angajați alocați"}.
        </span>
      ) : null}

      {eroare === null ? null : (
        <span role="alert" className="text-danger text-nota block">
          {eroare}
        </span>
      )}

      {editeaza ? (
        <Dialog
          deschis
          laInchidere={inchide}
          titlu={`Editează „${functie.denumire}”`}
          descriere="Codul intern nu se schimbă: funcția apare sub el pe contractele deja emise."
          marime="mare"
        >
          <Formular
            actiune={trimiteEditare}
            laReusita={laReusita}
            mesajReusita="Funcția a fost salvată."
          >
            {(stare) => (
              <>
                <CampuriFunctie stare={stare} idc={idc} initiale={functie} cuCodIntern={false} />
                <BaraActiuni aliniere="final" separata lipitaPeTelefon>
                  <Buton varianta="secundar" onClick={inchide} disabled={stare.inCurs}>
                    Renunță
                  </Buton>
                  <Buton
                    type="submit"
                    varianta="primar"
                    inCurs={stare.inCurs}
                    textInCurs="Se salvează…"
                  >
                    Salvează
                  </Buton>
                </BaraActiuni>
              </>
            )}
          </Formular>
        </Dialog>
      ) : null}
    </span>
  );
}
