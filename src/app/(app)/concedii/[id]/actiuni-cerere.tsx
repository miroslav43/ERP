// src/app/(app)/concedii/[id]/actiuni-cerere.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Send } from "lucide-react";

import { Buton } from "@/components/ui/buton";
import { Callout } from "@/components/ui/callout";

import { anuleazaCerere, trimiteCerere } from "../actions";

/**
 * Ce se poate face cu o cerere de pe fișa ei.
 *
 * ── CE REPARĂ ─────────────────────────────────────────────────────────────
 * Ecranul oferea, pe o CIORNĂ, exact un buton: „Anulează cererea”. Ciorna se
 * putea crea din formular și nu se putea trimite din nicio parte a produsului —
 * modulul avea trei acțiuni și niciuna nu ridica o ciornă la „trimisă”. Cine
 * apăsa „Salvează ca ciornă” își pierdea munca sau o refăcea de la zero.
 * Butonul primar de aici e capătul lipsă al acelui drum.
 *
 * Anularea a primit confirmare în doi pași în același timp, și nu ca zel: e o
 * stare TERMINALĂ (`anulata` nu mai are ieșire în nicio politică), stă acum
 * lângă un buton primar nou, iar tiparul exista deja în modul, la
 * `setari/buton-aplica-drepturi.tsx`. Consecința se scrie în text, nu se
 * subînțelege.
 */
export function ActiuniCerere({
  cerereId,
  esteCiorna = false,
  esteAprobata = false,
  poateAprobaPeLoc = false,
}: {
  readonly cerereId: string;
  /** Numai o ciornă se poate trimite; restul stărilor n-au buton de trimitere. */
  readonly esteCiorna?: boolean;
  /**
   * Cine se uită are `leave:approve = all`: ciorna nu pleacă spre nimeni, se
   * aprobă pe loc. Schimbă doar textul butonului — decizia o ia acțiunea, care
   * verifică singură permisiunea.
   */
  readonly poateAprobaPeLoc?: boolean;
  /**
   * Cererea e deja APROBATĂ, iar angajatul o retrage (0079).
   *
   * Schimbă numai cuvintele, nu comportamentul: acțiunea e aceeași, dar
   * consecințele nu sunt. La o ciornă nu s-a bazat nimeni pe nimic; aici
   * cineva a decis, pontajul e deja scris, iar aprobatorii vor fi anunțați.
   * Un ecran care numește la fel două lucruri diferite îl învață pe om să nu
   * mai citească avertismentul.
   */
  readonly esteAprobata?: boolean;
}) {
  const router = useRouter();
  const [eroare, setEroare] = useState<string | null>(null);
  const [confirmareCeruta, setConfirmareCeruta] = useState(false);
  /**
   * Zile de concediu peste care exista deja o linie de pontaj scrisă de om.
   *
   * Ține de STARE, nu de o notificare trecătoare: e singurul loc unde numărul
   * ajunge la cineva care poate repara, iar consecința tăcerii e că ziua se
   * plătește și ca lucrată, și ca zi de concediu. `role="alert"`, ca în
   * `DecizieAprobare` — supraviețuiește reîmprospătării paginii.
   */
  const [zilePastrate, setZilePastrate] = useState(0);
  const [inCurs, porneste] = useTransition();

  function trimite(): void {
    setEroare(null);
    setConfirmareCeruta(false);
    porneste(async () => {
      const rezultat = await trimiteCerere({ id: cerereId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setZilePastrate(rezultat.data.zilePastrate);
      router.refresh();
    });
  }

  function anuleaza(): void {
    setEroare(null);
    porneste(async () => {
      const rezultat = await anuleazaCerere({ id: cerereId });
      if (!rezultat.ok) {
        setEroare(rezultat.error.message);
        return;
      }
      setConfirmareCeruta(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {esteCiorna ? (
          <Buton
            varianta="primar"
            inCurs={inCurs}
            textInCurs={poateAprobaPeLoc ? "Se înregistrează…" : "Se trimite…"}
            onClick={trimite}
            disabled={confirmareCeruta}
          >
            <Send aria-hidden="true" className="size-4" />
            {poateAprobaPeLoc ? "Trimite și aprobă" : "Trimite spre aprobare"}
          </Buton>
        ) : null}

        {confirmareCeruta ? null : (
          <Buton
            varianta="distructiv"
            inCurs={inCurs}
            textInCurs="Se anulează…"
            onClick={() => {
              setEroare(null);
              setConfirmareCeruta(true);
            }}
          >
            <Ban aria-hidden="true" className="size-4" />
            {esteAprobata ? "Renunț la concediu" : "Anulează cererea"}
          </Buton>
        )}
      </div>

      {confirmareCeruta ? (
        <Callout
          fel="atentie"
          titlu={esteAprobata ? "Renunțați la concediul aprobat?" : "Anulați cererea?"}
          actiune={
            <div className="flex flex-wrap gap-2">
              <Buton
                varianta="distructiv"
                inCurs={inCurs}
                textInCurs="Se anulează…"
                onClick={anuleaza}
              >
                {esteAprobata ? "Da, renunț" : "Da, anulează"}
              </Buton>
              <Buton
                varianta="tertiar"
                disabled={inCurs}
                onClick={() => {
                  setConfirmareCeruta(false);
                }}
              >
                Renunț
              </Buton>
            </div>
          }
        >
          {esteAprobata ? (
            <>
              Concediul e aprobat, iar renunțarea e definitivă: zilele se întorc în sold, zilele de
              pontaj generate se retrag, iar cei care au aprobat cererea vor fi anunțați. Pentru
              aceeași perioadă va trebui depusă o cerere nouă, care se aprobă de la capăt.
            </>
          ) : (
            <>
              Anularea e definitivă: cererea nu mai poate fi trimisă după aceea, iar zilele ei se
              întorc în sold. Pentru aceeași perioadă va trebui depusă o cerere nouă.
            </>
          )}
        </Callout>
      ) : null}

      {/* Randat DOAR când există. Paragraful de dinainte stătea în pagină
          necondiționat și rezerva o linie liberă sub buton la fiecare
          încărcare a fișei. `Callout fel="eroare"` își pune singur
          `role="alert"`, deci mesajul se anunță la apariție. */}
      {eroare === null ? null : <Callout fel="eroare">{eroare}</Callout>}

      {/* Aprobarea pe loc scrie imediat zilele în pontaj, iar sincronizarea
          SARE peste zilele pe care angajatul și le-a pontat singur — le
          păstrează ca lucrate. Fără rândul ăsta, ziua ar rămâne și plătită ca
          muncă, și scăzută din sold, fără ca nimeni să afle. */}
      {zilePastrate === 0 ? null : (
        <Callout fel="atentie" titlu="Zile pontate peste concediu">
          {zilePastrate === 1
            ? "O zi din acest concediu era deja pontată ca lucrată și a rămas așa."
            : `${String(zilePastrate)} zile din acest concediu erau deja pontate ca lucrate și au rămas așa.`}{" "}
          Verificați-le în pontaj: altfel se plătesc și ca muncă, și ca zile de concediu.
        </Callout>
      )}
    </div>
  );
}
