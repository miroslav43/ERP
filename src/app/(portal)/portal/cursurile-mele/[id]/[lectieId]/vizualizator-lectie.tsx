"use client";

// src/app/(portal)/portal/cursurile-mele/[id]/[lectieId]/vizualizator-lectie.tsx
//
// ── CE MĂSURĂM ȘI CE NU ───────────────────────────────────────────────────
// Secundele se acumulează DOAR când redarea avansează în pași mici (sub 2 s
// între două evenimente `timeupdate`). O săritură înainte nu adaugă nimic:
// nu blochează derularea — omul are voie să deruleze — dar nici n-o numără ca
// vizionare. Serverul reclampează oricum pe ceasul lui, deci asta e o măsură de
// bună-credință, nu o barieră.
//
// ── NICIUN AUTOPLAY, NICIODATĂ ────────────────────────────────────────────
// Nici la reluare. Poziția salvată se OFERĂ („Ați rămas la 12:34”), cu două
// butoane; nu se sare automat.
//
// ── CONTROALELE NATIVE ────────────────────────────────────────────────────
// `<video controls>` aduce gratuit Space, săgeți, M, F și subtitrările. Un
// player propriu ar fi însemnat să le reconstruiesc pe toate, prost.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";
import { Nivel } from "@/components/ui/nivel";
import { arataToast } from "@/components/ui/toast";
import {
  durataCitibila,
  esteFinalizabila,
  pozitieCitibila,
  secundeNecesare,
  type Lectie,
} from "@/domain/cursuri/scadente";

import { incheieLectie, raporteazaProgres } from "../../actions";

/** La cât timp se trimite progresul. 15 s: destul de rar cât să nu conteze. */
const INTERVAL_RAPORTARE_MS = 15_000;
/** Peste atât, saltul e derulare, nu vizionare. */
const PRAG_SALT_S = 2;

interface Proprietati {
  readonly lectieId: string;
  readonly inrolareId: string;
  readonly lectie: Lectie;
  readonly versiuneId: string | null;
  readonly areSubtitrare: boolean;
}

export function VizualizatorVideo({
  lectieId,
  inrolareId,
  lectie,
  versiuneId,
  areSubtitrare,
}: Proprietati) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement | null>(null);
  const ultimulMoment = useRef<number>(0);
  const acumulat = useRef<number>(lectie.secundeVizionate);
  const netrimis = useRef<boolean>(false);

  const [secunde, setSecunde] = useState(lectie.secundeVizionate);
  const [status, setStatus] = useState(lectie.status);
  const [eroare, setEroare] = useState<string | null>(null);
  const [inCurs, porneste] = useTransition();
  const [reluareOferita, setReluareOferita] = useState(lectie.status !== "finalizat");

  const trimite = useCallback(async (): Promise<void> => {
    if (!netrimis.current) return;
    netrimis.current = false;
    const rezultat = await raporteazaProgres({
      id: lectieId,
      secunde_vizionate: Math.round(acumulat.current),
      pozitie_secunde: Math.round(video.current?.currentTime ?? 0),
    });
    if (rezultat.ok) {
      // Valoarea REALĂ, cea clampată de server — nu ce am propus. Altfel bara
      // ar arăta un număr pe care baza l-a refuzat.
      acumulat.current = rezultat.data.secundeVizionate;
      setSecunde(rezultat.data.secundeVizionate);
      setStatus(rezultat.data.status);
    }
  }, [lectieId]);

  useEffect(() => {
    const cronometru = setInterval(() => {
      void trimite();
    }, INTERVAL_RAPORTARE_MS);

    // `pagehide`, nu `beforeunload`: al doilea nu se declanșează pe iOS și nici
    // când pagina intră în cache-ul de navigare înapoi.
    const laIesire = (): void => {
      void trimite();
    };
    window.addEventListener("pagehide", laIesire);
    return () => {
      clearInterval(cronometru);
      window.removeEventListener("pagehide", laIesire);
      void trimite();
    };
  }, [trimite]);

  const laTimeUpdate = useCallback((): void => {
    const el = video.current;
    if (el === null) return;
    const acum = el.currentTime;
    const delta = acum - ultimulMoment.current;
    ultimulMoment.current = acum;
    // Numai pașii mici contează. O săritură (delta mare) sau o derulare înapoi
    // (delta negativ) nu adaugă nimic.
    if (delta > 0 && delta <= PRAG_SALT_S) {
      acumulat.current += delta;
      netrimis.current = true;
      setSecunde(Math.round(acumulat.current));
    }
  }, []);

  const stareLectie: Lectie = { ...lectie, status, secundeVizionate: secunde };
  const poate = esteFinalizabila(stareLectie);
  const necesar =
    lectie.treaptaDovada === "parcurgere" &&
    lectie.durataSecunde !== null &&
    lectie.procentMinim !== null
      ? secundeNecesare(lectie.durataSecunde, lectie.procentMinim)
      : null;

  const incheie = useCallback((): void => {
    setEroare(null);
    porneste(async () => {
      await trimite();
      const rezultat = await incheieLectie({ id: lectieId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setStatus("finalizat");
      arataToast({ fel: "reusita", text: "Lecția a fost marcată ca parcursă." });
      router.push(`/portal/cursurile-mele/${inrolareId}`);
      router.refresh();
    });
  }, [inrolareId, lectieId, router, trimite]);

  return (
    <div className="space-y-4">
      {/*
        Condiția NU citește `video.current`: un `ref` accesat în timpul randării
        nu declanșează re-randarea, deci oferta ar rămâne pe ecran sau ar
        dispărea la momentul greșit. Starea `reluareOferita` e singura sursă —
        se stinge când omul alege, în manipulatorul de eveniment.
      */}
      {reluareOferita && lectie.status !== "finalizat" && lectie.secundeVizionate > 0 ? (
        <Callout
          fel="informativ"
          titlu={`Ați rămas la ${pozitieCitibila(lectie.secundeVizionate)}`}
          actiune={
            <div className="flex gap-2">
              <Buton
                varianta="primar"
                onClick={() => {
                  if (video.current !== null) {
                    video.current.currentTime = lectie.secundeVizionate;
                    ultimulMoment.current = lectie.secundeVizionate;
                  }
                  setReluareOferita(false);
                }}
              >
                Reluați de acolo
              </Buton>
              <Buton
                varianta="tertiar"
                onClick={() => {
                  setReluareOferita(false);
                }}
              >
                De la început
              </Buton>
            </div>
          }
        >
          Alegeți de unde continuați. Nu sărim automat.
        </Callout>
      ) : null}

      {versiuneId === null ? (
        <Callout fel="atentie" titlu="Lecția nu are conținut">
          Materialul nu are încă un fișier încărcat. Anunțați administratorul.
        </Callout>
      ) : (
        <video
          ref={video}
          controls
          playsInline
          preload="metadata"
          className="border-border rounded-panou w-full border bg-black"
          onTimeUpdate={laTimeUpdate}
          onSeeked={() => {
            ultimulMoment.current = video.current?.currentTime ?? 0;
          }}
        >
          <source src={`/api/materiale/${versiuneId}`} />
          {areSubtitrare ? (
            <track
              kind="subtitles"
              srcLang="ro"
              label="Română"
              default
              src={`/api/materiale/${versiuneId}?subtitrare=1`}
            />
          ) : null}
          Browserul dumneavoastră nu poate reda acest film.
        </video>
      )}

      {necesar === null ? null : (
        <Nivel
          valoare={Math.min(secunde, necesar)}
          din={necesar}
          eticheta="Cât ați urmărit"
          text={`${durataCitibila(secunde)} din ${durataCitibila(necesar)} necesare`}
          ton={secunde >= necesar ? "bun" : "neutru"}
        />
      )}

      {eroare === null ? null : (
        <Callout fel="eroare" titlu="Nu s-a putut înregistra">
          {eroare}
        </Callout>
      )}

      {status === "finalizat" ? (
        <Callout fel="informativ" titlu="Ați parcurs această lecție">
          O puteți revedea oricând.
        </Callout>
      ) : (
        <BaraActiuni eticheta="Încheierea lecției" lipitaPeTelefon>
          <div className="flex flex-col gap-1">
            <Buton
              varianta="primar"
              disabled={!poate.poate || inCurs}
              inCurs={inCurs}
              textInCurs="Se înregistrează…"
              onClick={incheie}
            >
              Am parcurs lecția
            </Buton>
            {/* Butonul dezactivat are MEREU motivul scris sub el. Unul mut e
                la fel de rău ca unul care eșuează. */}
            {poate.poate ? null : <p className="text-muted-foreground text-nota">{poate.motiv}</p>}
          </div>
        </BaraActiuni>
      )}
    </div>
  );
}
