"use client";

import { useCallback, useState, useTransition, type ReactElement } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Pencil, Trash2 } from "lucide-react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { ConfirmareActiune, Dialog } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";
import { IntrareData } from "@/components/ui/intrare-data";
import { arataToast } from "@/components/ui/toast";
import { sfarsitulZileiRomania } from "@/domain/announcements/anunt";
import type { ActionResult } from "@/lib/actions/types";
import { toBucharestDateString, todayInBucharest } from "@/lib/format/date";

import { actualizeazaAnunt, retrageAnunt, stergeAnunt } from "../actions";

/**
 * Ce poate face administratorul cu un anunț DUPĂ ce l-a scris.
 *
 * Până aici, fișa oferea doar „Publică acum": o ciornă cu o greșeală de
 * tastare nu se putea corecta, iar un anunț publicat nu se putea nici retrage,
 * nici desfixa — un anunț fixat fără dată de expirare stătea în capul
 * avizierului la nesfârșit (analiza din 2026-10-08, anunturi-L5/O2).
 *
 * Trei controale, cu trei consecințe diferite, deci trei confirmări diferite:
 *  - Editează — aceeași casetă ca la creare, precompletată; fără „Publică",
 *    publicarea rămâne butonul ei. Nu retrimite notificări.
 *  - Retrage — doar pe un anunț publicat: îi pune expirarea ACUM, deci iese
 *    de pe avizierul angajaților, dar rămâne pe fișă cu confirmările strânse.
 *  - Șterge — orice stare: dispare și pentru administratori; drumul de
 *    întoarcere e lista.
 */
export function ActiuniAnunt({
  anunt,
  publicat,
  activ,
}: Readonly<{
  anunt: Readonly<{
    id: string;
    titlu: string;
    continut: string;
    fixat: boolean;
    expira_la: string | null;
  }>;
  /** Are `publicat_la` în trecut (activ sau expirat). */
  publicat: boolean;
  /** Se vede acum pe avizierul angajaților — singura stare din care are sens „Retrage". */
  activ: boolean;
}>): ReactElement {
  const router = useRouter();
  const [editare, setEditare] = useState(false);
  const [retragere, setRetragere] = useState(false);
  const [stergere, setStergere] = useState(false);
  const [inCurs, porneste] = useTransition();

  const inchideEditarea = useCallback((): void => {
    setEditare(false);
  }, []);
  const laReusita = useCallback((): void => {
    setEditare(false);
    arataToast({ fel: "reusita", text: "Anunțul a fost actualizat." });
    router.refresh();
  }, [router]);

  async function salveaza(date: FormData): Promise<ActionResult<{ id: string }>> {
    const expira = String(date.get("expira_la") ?? "").trim();
    return actualizeazaAnunt({
      id: anunt.id,
      titlu: String(date.get("titlu") ?? ""),
      continut: String(date.get("continut") ?? ""),
      fixat: date.get("fixat") === "on",
      expira_la: expira.length === 0 ? null : sfarsitulZileiRomania(expira),
    });
  }

  function retrage(): void {
    porneste(async () => {
      const rezultat = await retrageAnunt({ id: anunt.id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setRetragere(false);
      arataToast({ fel: "reusita", text: "Anunțul a fost retras de pe avizier." });
      router.refresh();
    });
  }

  function sterge(): void {
    porneste(async () => {
      const rezultat = await stergeAnunt({ id: anunt.id });
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setStergere(false);
      arataToast({ fel: "reusita", text: `Anunțul „${anunt.titlu}” a fost șters.` });
      router.push("/anunturi");
    });
  }

  const expiraImplicit =
    anunt.expira_la === null ? "" : toBucharestDateString(new Date(anunt.expira_la));

  return (
    <>
      <Buton
        varianta="secundar"
        onClick={() => {
          setEditare(true);
        }}
      >
        <Pencil aria-hidden="true" className="size-4" />
        Editează
      </Buton>
      {activ ? (
        <Buton
          varianta="secundar"
          onClick={() => {
            setRetragere(true);
          }}
        >
          <EyeOff aria-hidden="true" className="size-4" />
          Retrage
        </Buton>
      ) : null}
      <Buton
        varianta="tertiar"
        marime="iconita"
        aria-label={`Șterge anunțul ${anunt.titlu}`}
        onClick={() => {
          setStergere(true);
        }}
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </Buton>

      {editare ? (
        <Dialog
          deschis
          laInchidere={inchideEditarea}
          titlu="Editează anunțul"
          descriere={
            publicat
              ? "Modificarea se vede imediat pe avizier. Nu se trimite o notificare nouă."
              : "Ciorna rămâne nepublicată până apăsați „Publică acum”."
          }
          marime="mare"
        >
          <Formular actiune={salveaza} laReusita={laReusita}>
            {(stare) => (
              <>
                <Camp
                  nume="titlu"
                  eticheta="Titlu"
                  obligatoriu
                  {...(stare.erori["titlu"] === undefined ? {} : { erori: stare.erori["titlu"] })}
                >
                  {(atribute) => (
                    <input
                      {...atribute}
                      maxLength={200}
                      defaultValue={stare.valoriTrimise["titlu"] ?? anunt.titlu}
                    />
                  )}
                </Camp>

                <Camp
                  nume="continut"
                  eticheta="Conținut"
                  fel="textarea"
                  obligatoriu
                  ajutor="Rândurile goale se păstrează. Primele două rânduri se văd în listă."
                  {...(stare.erori["continut"] === undefined
                    ? {}
                    : { erori: stare.erori["continut"] })}
                >
                  {(atribute) => (
                    <textarea
                      {...atribute}
                      rows={8}
                      maxLength={10000}
                      defaultValue={stare.valoriTrimise["continut"] ?? anunt.continut}
                    />
                  )}
                </Camp>

                <Camp
                  nume="expira_la"
                  eticheta="Expiră la"
                  ajutor="După ziua asta, anunțul dispare de pe avizierul angajaților. Lăsați gol pentru un anunț fără termen."
                  {...(stare.erori["expira_la"] === undefined
                    ? {}
                    : { erori: stare.erori["expira_la"] })}
                >
                  {(atribute) => (
                    <IntrareData
                      {...atribute}
                      min={todayInBucharest()}
                      implicit={stare.valoriTrimise["expira_la"] ?? expiraImplicit}
                    />
                  )}
                </Camp>

                <label className="text-corp flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="fixat"
                    className={`${clasaBifa} mt-0.5`}
                    defaultChecked={
                      stare.valoriTrimise["fixat"] === undefined
                        ? anunt.fixat
                        : stare.valoriTrimise["fixat"] === "on"
                    }
                  />
                  <span>
                    Fixează în capul listei
                    <span className="text-muted-foreground text-nota mt-0.5 block">
                      Rămâne deasupra celorlalte anunțuri, cu o muchie navy pe margine.
                    </span>
                  </span>
                </label>

                <BaraActiuni aliniere="final" separata lipitaPeTelefon>
                  <Buton varianta="secundar" onClick={inchideEditarea} disabled={stare.inCurs}>
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

      <ConfirmareActiune
        deschis={retragere}
        laInchidere={() => {
          setRetragere(false);
        }}
        titlu="Retrageți anunțul de pe avizier?"
        consecinta="Anunțul expiră acum: angajații nu-l mai văd. Rămâne pe fișa asta, cu confirmările de citire strânse până acum."
        etichetaConfirmare="Retrage anunțul"
        inCurs={inCurs}
        laConfirmare={retrage}
      />
      <ConfirmareActiune
        deschis={stergere}
        laInchidere={() => {
          setStergere(false);
        }}
        titlu="Ștergeți anunțul?"
        consecinta={`„${anunt.titlu}” dispare de pe avizier și din lista de administrare. Nu se poate anula.`}
        etichetaConfirmare="Șterge anunțul"
        distructiv
        inCurs={inCurs}
        laConfirmare={sterge}
      />
    </>
  );
}
