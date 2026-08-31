"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Camp, clasaBifa } from "@/components/ui/camp";
import { Dialog } from "@/components/ui/dialog";
import { Formular } from "@/components/ui/formular";
import { IntrareData } from "@/components/ui/intrare-data";
import type { ActionResult } from "@/lib/actions/types";
import { sfarsitulZileiRomania } from "@/domain/announcements/anunt";
import { todayInBucharest } from "@/lib/format/date";

import { creeazaAnunt } from "./actions";

/**
 * Anunțul nou, într-o CASETĂ deschisă din antetul avizierului.
 *
 * ── DE CE NU MAI STĂ DESFĂCUT ÎN PAGINĂ ───────────────────────────────────
 * Formularul era randat permanent, ÎNAINTEA listei. Consecința pe ecranul unui
 * administrator: primul lucru de pe avizier era un formular gol de patru
 * câmpuri, iar anunțurile — motivul pentru care se deschide pagina — începeau
 * sub linia de plutire. Exact cazul descris în `components/ui/formular-dialog.tsx`,
 * unde 27 de formulare desfăcute în pagină au fost mutate în casete.
 *
 * `FormularDialog` nu se poate folosi aici, din același motiv ca la cererea de
 * concediu: are UN singur buton de trimitere, iar anunțul are două — „Publică"
 * și „Salvează ca ciornă" — cu aceeași acțiune și intenții diferite.
 *
 * ── CELE DOUĂ CAPCANE DE CASETĂ ───────────────────────────────────────────
 * 1. Butoanele stau ÎN `<form>`, într-un `BaraActiuni`: `subsol`-ul lui
 *    `Dialog` e FRATE cu formularul în DOM, deci un buton pus acolo n-ar putea
 *    nici să trimită, nici să citească `stare.inCurs`.
 * 2. `{deschis ? <Dialog … /> : null}` — caseta se RANDEAZĂ, nu se ascunde.
 *    Aici asta ține loc și de golire: câmpurile sunt necontrolate, iar
 *    demontarea le curăță de ce rămăsese dintr-o încercare anterioară.
 *
 * Caseta NU se închide la refuz — doar `laReusita` o închide. `Formular`
 * repune valorile trimise prin `valoriTrimise`, fiindcă React 19 resetează
 * formularul după acțiune inclusiv când aceasta a eșuat.
 *
 * ── DE CE „PUBLICĂ" NU MAI E BUTONUL DIN STÂNGA ───────────────────────────
 * Vechea bară punea „Publică" primul și „Salvează ca ciornă" al doilea, ambele
 * fără confirmare. Publicarea trimite o notificare fiecărui membru activ al
 * firmei (`anunataMembrii`) și e ireversibilă din interfață: nu există
 * „retrage". Rămâne acțiunea primară, dar ultima în ordinea de citire, unde
 * stau acțiunile primare peste tot în produs.
 */
export function DialogAnuntNou() {
  const router = useRouter();
  const [deschis, setDeschis] = useState(false);

  /**
   * Intenția ultimului buton apăsat.
   *
   * Ref, nu state: se citește în `trimite`, care rulează DUPĂ `onClick`-ul
   * butonului, iar o valoare de stare setată în același tur n-ar fi încă
   * vizibilă acolo. Același tipar ca la cererea de concediu.
   */
  const publica = useRef(false);

  const inchide = useCallback((): void => {
    setDeschis(false);
  }, []);

  /**
   * Stabil prin `useCallback`: `laReusita` intră în dependențele efectului din
   * `Formular`. O funcție nouă la fiecare randare ar reporni efectul după
   * succes — iar aici asta ar însemna DOUĂ navigări către fișa anunțului, nu
   * doar o notificare afișată de două ori.
   */
  const laReusita = useCallback(
    (data: { id: string }): void => {
      setDeschis(false);
      router.push(`/anunturi/${data.id}`);
    },
    [router],
  );

  async function trimite(date: FormData): Promise<ActionResult<{ id: string }>> {
    const expira = String(date.get("expira_la") ?? "").trim();
    return creeazaAnunt({
      titlu: String(date.get("titlu") ?? ""),
      continut: String(date.get("continut") ?? ""),
      fixat: date.get("fixat") === "on",
      publica_acum: publica.current,
      // Ultima secundă a zilei alese, în ora României — nu în fusul
      // browserului. Vezi `sfarsitulZileiRomania`.
      expira_la: expira.length === 0 ? null : sfarsitulZileiRomania(expira),
    });
  }

  return (
    <>
      <Buton
        varianta="primar"
        onClick={() => {
          setDeschis(true);
        }}
      >
        <Plus aria-hidden="true" className="size-4" />
        Anunț nou
      </Buton>

      {deschis ? (
        <Dialog
          deschis
          laInchidere={inchide}
          titlu="Anunț nou"
          descriere="Publicarea trimite o notificare fiecărui membru activ al firmei."
          marime="mare"
        >
          <Formular actiune={trimite} laReusita={laReusita}>
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
                      defaultValue={stare.valoriTrimise["titlu"] ?? ""}
                      placeholder="Program de lucru în perioada sărbătorilor"
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
                      defaultValue={stare.valoriTrimise["continut"] ?? ""}
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
                      implicit={stare.valoriTrimise["expira_la"] ?? ""}
                    />
                  )}
                </Camp>

                <label className="text-corp flex items-start gap-2">
                  <input
                    type="checkbox"
                    name="fixat"
                    className={`${clasaBifa} mt-0.5`}
                    defaultChecked={stare.valoriTrimise["fixat"] === "on"}
                  />
                  <span>
                    Fixează în capul listei
                    <span className="text-muted-foreground text-nota mt-0.5 block">
                      Rămâne deasupra celorlalte anunțuri, cu o muchie navy pe margine.
                    </span>
                  </span>
                </label>

                <BaraActiuni aliniere="final" separata lipitaPeTelefon>
                  <Buton varianta="secundar" onClick={inchide} disabled={stare.inCurs}>
                    Renunță
                  </Buton>
                  <Buton
                    type="submit"
                    varianta="secundar"
                    inCurs={stare.inCurs}
                    textInCurs="Se salvează…"
                    onClick={() => {
                      publica.current = false;
                    }}
                  >
                    Salvează ca ciornă
                  </Buton>
                  <Buton
                    type="submit"
                    varianta="primar"
                    inCurs={stare.inCurs}
                    textInCurs="Se publică…"
                    onClick={() => {
                      publica.current = true;
                    }}
                  >
                    Publică acum
                  </Buton>
                </BaraActiuni>
              </>
            )}
          </Formular>
        </Dialog>
      ) : null}
    </>
  );
}
