"use client";

import { useRouter } from "next/navigation";
import { useId, type ReactElement } from "react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";

import { comenteazaSesizare } from "../actions";

/**
 * Comentariul inline de pe fișa sesizării — conversațional, ca la tichete.
 * Pe `Formular` (nu `<form action>` gol), ca eroarea să stea pe câmp și
 * butonul să se stingă cât trimiterea e în zbor. Bifa de notă internă apare
 * doar gestionarului; raportorul n-o vede și n-o poate trimite (politica de
 * INSERT o refuză oricum).
 */
export function FormularComentariu({
  sesizareId,
  poateNotaInterna,
}: Readonly<{ sesizareId: string; poateNotaInterna: boolean }>): ReactElement {
  const router = useRouter();
  const id = useId();

  async function trimite(date: FormData) {
    return comenteazaSesizare({
      fault_report_id: sesizareId,
      continut: String(date.get("continut") ?? "").trim(),
      intern: date.get("intern") === "on",
    });
  }

  return (
    <Formular
      actiune={trimite}
      mesajReusita="Comentariul a fost adăugat."
      laReusita={() => {
        router.refresh();
      }}
    >
      {(stare) => (
        <>
          <Camp
            nume="continut"
            id={`${id}-continut`}
            eticheta="Adăugați un comentariu"
            fel="textarea"
            obligatoriu
            erori={stare.erori["continut"] ?? []}
          >
            {(a) => <textarea {...a} rows={3} maxLength={4000} />}
          </Camp>
          <BaraActiuni aliniere="start">
            <Buton type="submit" varianta="primar" inCurs={stare.inCurs} textInCurs="Se trimite…">
              Trimite
            </Buton>
            {poateNotaInterna ? (
              <label className="text-muted-foreground text-corp flex items-center gap-2">
                <input id={`${id}-intern`} name="intern" type="checkbox" className={clasaBifa} />
                Notă internă — raportorul n-o vede
              </label>
            ) : null}
          </BaraActiuni>
        </>
      )}
    </Formular>
  );
}
