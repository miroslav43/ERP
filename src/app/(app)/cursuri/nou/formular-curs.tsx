"use client";

// src/app/(app)/cursuri/nou/formular-curs.tsx
//
// `<Formular>` + `<Camp>`, nu `<form action={fn}>` cu câmpuri necontrolate: cu
// al doilea, React 19 RESETEAZĂ formularul după acțiune, inclusiv când acțiunea
// a fost REFUZATĂ. Un cod deja folosit — respins de indexul unic, deci abia
// după drumul la server — ar șterge tot ce a scris omul. `valoriTrimise` le
// pune înapoi ca `defaultValue`.

import { useCallback, useId } from "react";
import { useRouter } from "next/navigation";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";

import { actualizeazaCurs, creeazaCurs } from "../actions";

export interface ValoriCurs {
  readonly id: string;
  readonly cod: string;
  readonly denumire: string;
  readonly descriere: string | null;
  readonly obligatoriu: boolean;
  readonly valabilitate_luni: number | null;
  readonly termen_zile: number;
  readonly prag_avertizare_zile: number;
}

interface Proprietati {
  readonly initial?: ValoriCurs;
}

/** Cheile obiectului sunt EXACT cele din `creeazaCursSchema`. */
function citeste(date: FormData) {
  const valabilitate = String(date.get("valabilitate_luni") ?? "");
  return {
    cod: String(date.get("cod") ?? ""),
    denumire: String(date.get("denumire") ?? ""),
    descriere: String(date.get("descriere") ?? ""),
    obligatoriu: date.get("obligatoriu") === "on",
    valabilitate_luni: valabilitate === "" ? null : valabilitate,
    termen_zile: String(date.get("termen_zile") ?? "30"),
    prag_avertizare_zile: String(date.get("prag_avertizare_zile") ?? "30"),
  };
}

export function FormularCurs({ initial }: Proprietati) {
  const router = useRouter();
  const idFormular = useId();
  const idc = (sufix: string): string => `${idFormular}-${sufix}`;
  const esteEditare = initial !== undefined;

  const trimite = useCallback(
    async (date: FormData) =>
      esteEditare
        ? actualizeazaCurs({ id: initial.id, ...citeste(date) })
        : creeazaCurs(citeste(date)),
    [esteEditare, initial],
  );

  // `useCallback`: `laReusita` intră în lista de dependențe a efectului din
  // `Formular`. O funcție nouă la fiecare randare ar reporni efectul, deci
  // notificarea de succes ar apărea de două ori.
  const laReusita = useCallback(
    (date: { id: string }): void => {
      router.push(`/cursuri/${date.id}`);
      router.refresh();
    },
    [router],
  );

  return (
    <Formular
      actiune={trimite}
      laReusita={laReusita}
      mesajReusita={esteEditare ? "Cursul a fost salvat." : "Cursul a fost creat."}
      className="grid gap-4 sm:grid-cols-2"
    >
      {(stare) => (
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
                defaultValue={stare.valoriTrimise["denumire"] ?? initial?.denumire ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="cod"
            id={idc("cod")}
            eticheta="Cod"
            obligatoriu
            ajutor="Litere mici, cifre și liniuță jos. Apare în adeverință și în export."
            erori={stare.erori["cod"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="text"
                maxLength={40}
                defaultValue={stare.valoriTrimise["cod"] ?? initial?.cod ?? ""}
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
                rows={3}
                maxLength={2000}
                defaultValue={stare.valoriTrimise["descriere"] ?? initial?.descriere ?? ""}
              />
            )}
          </Camp>

          <Camp
            nume="termen_zile"
            id={idc("termen_zile")}
            eticheta="Termen de parcurgere (zile)"
            ajutor="Câte zile are angajatul de la atribuire."
            erori={stare.erori["termen_zile"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min={1}
                max={365}
                defaultValue={
                  stare.valoriTrimise["termen_zile"] ?? String(initial?.termen_zile ?? 30)
                }
              />
            )}
          </Camp>

          <Camp
            nume="valabilitate_luni"
            id={idc("valabilitate_luni")}
            eticheta="Valabilitate (luni)"
            ajutor="Lăsați gol dacă nu expiră. Cu o valoare, cursul reapare singur la termen."
            erori={stare.erori["valabilitate_luni"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min={1}
                max={120}
                defaultValue={
                  stare.valoriTrimise["valabilitate_luni"] ??
                  (initial?.valabilitate_luni === null || initial?.valabilitate_luni === undefined
                    ? ""
                    : String(initial.valabilitate_luni))
                }
              />
            )}
          </Camp>

          <Camp
            nume="prag_avertizare_zile"
            id={idc("prag_avertizare_zile")}
            eticheta="Preaviz la expirare (zile)"
            ajutor="Cu cât timp înainte se aprinde avertismentul de recertificare."
            erori={stare.erori["prag_avertizare_zile"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min={1}
                max={180}
                defaultValue={
                  stare.valoriTrimise["prag_avertizare_zile"] ??
                  String(initial?.prag_avertizare_zile ?? 30)
                }
              />
            )}
          </Camp>

          <label className="flex items-center gap-2 self-end sm:col-span-2">
            <input
              type="checkbox"
              name="obligatoriu"
              defaultChecked={initial?.obligatoriu ?? true}
              className="size-4 pointer-coarse:size-6"
            />
            <span className="text-corp">Curs obligatoriu</span>
          </label>

          <BaraActiuni className="sm:col-span-2">
            <Buton
              type="submit"
              varianta="primar"
              inCurs={stare.inCurs}
              textInCurs={esteEditare ? "Se salvează…" : "Se creează…"}
            >
              {esteEditare ? "Salvează" : "Creează cursul"}
            </Buton>
          </BaraActiuni>
        </>
      )}
    </Formular>
  );
}
