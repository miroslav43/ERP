"use client";

// src/app/(app)/flota/rezervari/actiuni-rezervare.tsx
//
// Acțiunile de pe rândul unei rezervări (0216, F12d): Aprobă / Respinge (cu
// motiv), Anulează (motivul e obligatoriu când rezervarea nu e a ta — îl cere
// baza), Returnează mai devreme (data, cu `min` = `pragScurtare`).
//
// Fiecare formular are propriul `<Formular>` și propriile erori (lecția din
// `foi/[id]/actiuni-foaie.tsx`): un refuz la anulare nu înroșește decizia, iar
// motivul tastat rămâne după un refuz. Aprobarea e un buton pe `useTransition`,
// fără câmpuri de pierdut.
//
// Ce butoane apar decide pagina (drepturile) ȘI domeniul (starea și ziua): baza
// rămâne cea care refuză, cu P0001, tot ce ar scăpa de aici.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useId, useState, useTransition, type ReactElement } from "react";

import { Buton } from "@/components/ui/buton";
import { Camp } from "@/components/ui/camp";
import { Formular } from "@/components/ui/formular";
import { adaugaZile } from "@/domain/attendance/saptamana";
import {
  poateAnula,
  poateDecide,
  poateScurta,
  pragScurtare,
  type StatusRezervare,
} from "@/domain/fleet/rezervari";

import { anuleazaRezervarea, decideRezervarea, scurteazaRezervarea } from "./actions";
import { motivDin } from "./valori-rezervare";

export type RezervareActiuni = Readonly<{
  id: string;
  vehicle_id: string;
  status: StatusRezervare;
  de_la: string;
  pana_la: string;
}>;

export type PropsActiuniRezervare = Readonly<{
  rezervare: RezervareActiuni;
  azi: string;
  /** Aprobator al acestui angajat și nu e rezervarea lui (baza refuză oricum auto-decizia). */
  poateDecide: boolean;
  /** Drept de anulare / scurtare pe rezervarea asta (`update` sau `approve`). */
  poateModifica: boolean;
  /** Rezervarea e a celui conectat: anularea nu cere motiv. */
  esteAMea: boolean;
  /** „Începe foaia zilei”: doar pe rezervarea proprie confirmată, în ziua ei. */
  hrefFoaieZilei?: string | null;
}>;

type Mod = "nimic" | "respinge" | "anuleaza" | "scurteaza";

export function ActiuniRezervare({
  rezervare,
  azi,
  poateDecide: areDreptDecizie,
  poateModifica,
  esteAMea,
  hrefFoaieZilei = null,
}: PropsActiuniRezervare): ReactElement | null {
  const router = useRouter();
  const [mod, setMod] = useState<Mod>("nimic");
  const [inCurs, porneste] = useTransition();
  const [eroare, setEroare] = useState<string | null>(null);
  const idMotivRespingere = useId();
  const idMotivAnulare = useId();
  const idPanaLa = useId();

  const reimprospateaza = useCallback(() => {
    setMod("nimic");
    router.refresh();
  }, [router]);

  const decide = areDreptDecizie && poateDecide(rezervare, azi);
  const anuleaza = poateModifica && poateAnula(rezervare, azi);
  const scurteaza = poateModifica && poateScurta(rezervare, azi);
  if (!decide && !anuleaza && !scurteaza && hrefFoaieZilei === null) return null;

  function aproba(): void {
    setEroare(null);
    porneste(async () => {
      const r = await decideRezervarea({
        id: rezervare.id,
        vehicle_id: rezervare.vehicle_id,
        decizie: "confirmata",
        motiv: null,
      });
      if (!r.ok) {
        setEroare(r.error.message);
        return;
      }
      router.refresh();
    });
  }

  const renunta = (
    <Buton
      type="button"
      varianta="secundar"
      onClick={() => {
        setMod("nimic");
        setEroare(null);
      }}
    >
      Renunță
    </Buton>
  );

  if (mod === "respinge") {
    return (
      <Formular
        actiune={(date: FormData) =>
          decideRezervarea({
            id: rezervare.id,
            vehicle_id: rezervare.vehicle_id,
            decizie: "respinsa",
            motiv: motivDin(date),
          })
        }
        laReusita={reimprospateaza}
        mesajReusita="Rezervarea a fost respinsă."
        className="w-full gap-2 sm:w-80"
      >
        {(stare) => (
          <>
            <Camp
              nume="motiv"
              id={idMotivRespingere}
              eticheta="Motivul respingerii"
              fel="textarea"
              obligatoriu
              erori={stare.erori["motiv"] ?? []}
            >
              {(a) => (
                <textarea
                  {...a}
                  rows={2}
                  maxLength={500}
                  defaultValue={stare.valoriTrimise["motiv"] ?? ""}
                />
              )}
            </Camp>
            <div className="flex gap-2">
              <Buton
                type="submit"
                varianta="distructiv"
                inCurs={stare.inCurs}
                textInCurs="Se trimite…"
              >
                Respinge
              </Buton>
              {renunta}
            </div>
          </>
        )}
      </Formular>
    );
  }

  if (mod === "anuleaza") {
    return (
      <Formular
        actiune={(date: FormData) =>
          anuleazaRezervarea({
            id: rezervare.id,
            vehicle_id: rezervare.vehicle_id,
            motiv: motivDin(date),
          })
        }
        laReusita={reimprospateaza}
        mesajReusita="Rezervarea a fost anulată."
        className="w-full gap-2 sm:w-80"
      >
        {(stare) => (
          <>
            <Camp
              nume="motiv"
              id={idMotivAnulare}
              eticheta={esteAMea ? "Motivul (opțional)" : "Motivul anulării"}
              fel="textarea"
              obligatoriu={!esteAMea}
              {...(esteAMea ? {} : { ajutor: "Angajatul îl primește în notificare." })}
              erori={stare.erori["motiv"] ?? []}
            >
              {(a) => (
                <textarea
                  {...a}
                  rows={2}
                  maxLength={500}
                  defaultValue={stare.valoriTrimise["motiv"] ?? ""}
                />
              )}
            </Camp>
            <div className="flex gap-2">
              <Buton
                type="submit"
                varianta="distructiv"
                inCurs={stare.inCurs}
                textInCurs="Se anulează…"
              >
                Anulează rezervarea
              </Buton>
              {renunta}
            </div>
          </>
        )}
      </Formular>
    );
  }

  if (mod === "scurteaza") {
    const prag = pragScurtare(rezervare, azi);
    const ultima = adaugaZile(rezervare.pana_la, -1);
    return (
      <Formular
        actiune={(date: FormData) =>
          scurteazaRezervarea({
            id: rezervare.id,
            vehicle_id: rezervare.vehicle_id,
            pana_la: String(date.get("pana_la") ?? "").trim(),
          })
        }
        laReusita={reimprospateaza}
        mesajReusita="Rezervarea a fost scurtată."
        className="w-full gap-2 sm:w-80"
      >
        {(stare) => (
          <>
            <Camp
              nume="pana_la"
              id={idPanaLa}
              eticheta="Returnez mașina în ziua"
              obligatoriu
              ajutor="Zilele de după se eliberează pentru colegi."
              erori={stare.erori["pana_la"] ?? []}
            >
              {(a) => (
                <input
                  {...a}
                  type="date"
                  min={prag}
                  max={ultima}
                  defaultValue={stare.valoriTrimise["pana_la"] ?? prag}
                />
              )}
            </Camp>
            <div className="flex gap-2">
              <Buton
                type="submit"
                varianta="primar"
                inCurs={stare.inCurs}
                textInCurs="Se salvează…"
              >
                Scurtează
              </Buton>
              {renunta}
            </div>
          </>
        )}
      </Formular>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {hrefFoaieZilei === null ? null : (
          <Link
            href={hrefFoaieZilei}
            className="text-corp self-center underline underline-offset-2"
          >
            Începe foaia zilei
          </Link>
        )}
        {decide ? (
          <>
            <Buton
              type="button"
              varianta="primar"
              inCurs={inCurs}
              textInCurs="Se trimite…"
              onClick={aproba}
            >
              Aprobă
            </Buton>
            <Buton
              type="button"
              varianta="secundar"
              disabled={inCurs}
              onClick={() => {
                setMod("respinge");
              }}
            >
              Respinge
            </Buton>
          </>
        ) : null}
        {scurteaza ? (
          <Buton
            type="button"
            varianta="secundar"
            disabled={inCurs}
            onClick={() => {
              setMod("scurteaza");
            }}
          >
            Returnez mai devreme
          </Buton>
        ) : null}
        {anuleaza ? (
          <Buton
            type="button"
            varianta="secundar"
            disabled={inCurs}
            onClick={() => {
              setMod("anuleaza");
            }}
          >
            Anulează
          </Buton>
        ) : null}
      </div>
      {eroare === null ? null : (
        <p role="alert" className="text-danger text-nota max-w-sm">
          {eroare}
        </p>
      )}
    </div>
  );
}
