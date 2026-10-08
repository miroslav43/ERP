"use client";

import { CalendarClock } from "lucide-react";
import { useCallback, type ReactElement } from "react";

import { Camp } from "@/components/ui/camp";
import { FormularDialog } from "@/components/ui/formular-dialog";
import type { VariantaButon } from "@/components/ui/buton";
import { formatDate } from "@/lib/format/date";

import { amanaPlan } from "./actions";

/**
 * Amânarea unui plan: scadența devine `greatest(calc, amanat_pana)`, iar
 * contorul de amânări crește — se vede pe fișă și intră în raport. O execuție
 * reușită o șterge. Planurile DOAR pe contor nu se pot amâna (baza refuză cu
 * mesaj propriu): butonul nu apare pentru ele, decizia e a apelantului.
 */
export function DialogAmanaPlan({
  planId,
  denumire,
  scadentaCurenta,
  numarAmanari,
  azi,
  compact = false,
  laReusita,
}: Readonly<{
  planId: string;
  denumire: string;
  scadentaCurenta: string | null;
  numarAmanari: number;
  azi: string;
  compact?: boolean;
  laReusita?: () => void;
}>): ReactElement {
  const trimite = useCallback(
    async (formular: FormData) =>
      await amanaPlan({
        id: planId,
        amanat_pana: String(formular.get("amanat_pana") ?? ""),
        motiv_amanare: String(formular.get("motiv_amanare") ?? ""),
      }),
    [planId],
  );

  const varianta: VariantaButon = compact ? "tertiar" : "secundar";
  // Minimul e ziua de după scadența curentă sau mâine: o „amânare” în trecut
  // n-ar schimba nimic (greatest), iar omul ar crede că a făcut ceva.
  const minim = scadentaCurenta !== null && scadentaCurenta > azi ? scadentaCurenta : azi;

  return (
    <FormularDialog
      declansator={{
        eticheta: "Amână",
        varianta,
        pictograma: <CalendarClock aria-hidden="true" className="size-4" />,
      }}
      titlu={`Amână „${denumire}”`}
      descriere={
        numarAmanari === 0
          ? "Scadența pe zile se mută la data aleasă. Amânarea se vede pe fișă și dispare la prima execuție reușită."
          : `Planul a mai fost amânat ${numarAmanari === 1 ? "o dată" : `de ${String(numarAmanari)} ori`}. Amânarea se vede pe fișă și dispare la prima execuție reușită.`
      }
      marime="mediu"
      actiune={trimite}
      mesajReusita="Planul a fost amânat."
      etichetaTrimite="Amână planul"
      textInCurs="Se salvează…"
      {...(laReusita === undefined ? {} : { laReusita })}
    >
      {(stare, idc) => (
        <div className="grid gap-3">
          <Camp
            nume="amanat_pana"
            id={idc("pana")}
            eticheta="Amânat până la"
            obligatoriu
            {...(scadentaCurenta === null
              ? {}
              : {
                  ajutor: `Scadența de acum: ${formatDate(scadentaCurenta)}. Data aleasă trebuie să fie după ea.`,
                })}
            erori={stare.erori["amanat_pana"] ?? []}
          >
            {(a) => (
              <input
                {...a}
                type="date"
                min={minim}
                defaultValue={stare.valoriTrimise["amanat_pana"] ?? ""}
              />
            )}
          </Camp>
          <Camp
            nume="motiv_amanare"
            id={idc("motiv")}
            eticheta="Motivul amânării"
            fel="textarea"
            obligatoriu
            erori={stare.erori["motiv_amanare"] ?? []}
          >
            {(a) => (
              <textarea
                {...a}
                rows={3}
                maxLength={1000}
                placeholder="Ex. piesa comandată ajunge pe 20; utilajul e în campanie până la sfârșitul lunii."
                defaultValue={stare.valoriTrimise["motiv_amanare"] ?? ""}
              />
            )}
          </Camp>
        </div>
      )}
    </FormularDialog>
  );
}
