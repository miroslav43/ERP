"use client";

// src/app/(app)/evaluari/sabloane/actiuni-sablon-evaluare.tsx

/**
 * Acțiunile de pe un card de șablon: editare, duplicare, arhivare, reactivare.
 *
 * ── DE CE ARHIVAREA ARE ACUM PERECHE ──────────────────────────────────────
 * Versiunea anterioară avea doar „Dezactivează", iar propriul ei comentariu
 * recunoștea că „nicio acțiune nu pune `activ` înapoi pe `true`": un clic
 * greșit era definitiv. Acum există `reactiveazaSablonEvaluare`, deci
 * confirmarea își schimbă și textul — consecința reală nu mai e ireversibilă.
 *
 * ── DE CE REZULTATUL SE CITEȘTE, NU SE IGNORĂ ─────────────────────────────
 * Regula rămâne cea scrisă aici înainte: un UPDATE respins de clauza `USING`
 * atinge zero rânduri și NU ridică eroare. Un `await …; router.refresh()` care
 * nu se uită la rezultat arată exact ca o reușită. Acțiunea întoarce refuzul;
 * ecranul trebuie să îl și SPUNĂ.
 *
 * ── DESPRE CUVÂNTUL „ARHIVEAZĂ" ──────────────────────────────────────────
 * O revizuire de pe `main` a obiectat, corect pentru starea de atunci, că
 * „arhivare" promite o listă de arhivă care nu există, și a păstrat „dezactivează"
 * în interfață. Obiecția cade odată cu ecranul ăsta: șablonul arhivat RĂMÂNE în
 * listă, cu pastila „Arhivat" și cu butonul „Reactivează" pe el. Arhiva e chiar
 * lista, deci cuvântul spune ce se întâmplă.
 *
 * ── DE CE ȘABLONUL DE PLATFORMĂ NU PRIMEȘTE „EDITEAZĂ" ────────────────────
 * Politica `evaluation_templates_update` cere `organization_id is not null`.
 * Un buton „Editează" pe el ar fi condamnat din construcție. În locul lui apare
 * „Personalizează", care duplică șablonul în firmă și deschide copia.
 *
 * ── „PERSONALIZEAZĂ" DESCHIDE CHIAR EDITORUL ──────────────────────────────
 * Până la 6 oct 2026 butonul crea copia și se oprea la un mesaj („O puteți
 * edita acum”): pe ecran apărea doar un card nou, „… (copie)”, iar omul nu
 * vedea nimic de personalizat — a șters copiile și a întrebat de ce șablonul
 * nu se poate personaliza. Acum copia păstrează numele original (e varianta
 * firmei, nu un duplicat), iar editorul ei se deschide imediat, chiar de aici:
 * datele copiei sunt cele ale originalului, deja pe client, plus id-ul întors
 * de acțiune. Nu printr-un `?editeaza=` în adresă — acela trecea prin randarea
 * de pe server și prin `loading.tsx`, iar editorul se închidea singur.
 * „Duplică”, pe un șablon al firmei, rămâne „(copie)”.
 *
 * ── DE CE „ȘTERGE" APARE DOAR PE ȘABLONUL NEFOLOSIT ───────────────────────
 * Evaluările făcute pe un șablon îl referă, deci el trebuie să rămână: se
 * arhivează. O copie nefolosită, în schimb, n-are nimic de păstrat — arhivată,
 * ar fi rămas pentru totdeauna în listă, cu pastila „Arhivat". Butonul se
 * ascunde pe `nrEvaluari > 0`, iar funcția din bază (0162) refuză oricum
 * același caz, cu mesaj, dacă între timp cineva a început o evaluare pe el.
 */

import { Archive, ArchiveRestore, Copy, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactElement } from "react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { ConfirmareActiune } from "@/components/ui/dialog";
import { arataToast } from "@/components/ui/toast";
import type { ActionResult } from "@/lib/actions/types";
import type { CriteriuSablon } from "@/domain/evaluations/criterii";

import { ConstructorSablon } from "../_components/constructor-sablon";
import {
  arhiveazaSablonEvaluare,
  duplicaSablonEvaluare,
  reactiveazaSablonEvaluare,
  stergeSablonEvaluare,
} from "../actions";

export type PropsActiuni = Readonly<{
  sablon: Readonly<{
    id: string;
    denumire: string;
    descriere: string | null;
    criterii: readonly CriteriuSablon[];
    versiune: number;
    activ: boolean;
    dePlatforma: boolean;
    nrEvaluari: number;
  }>;
}>;

/** „Evaluare anuală" → „Evaluare anuală (copie)", ca denumirea să nu fie goală. */
function denumireCopie(denumire: string): string {
  const propusa = `${denumire} (copie)`;
  return propusa.length <= 160 ? propusa : `${denumire.slice(0, 152)} (copie)`;
}

export function ActiuniSablonEvaluare({ sablon }: PropsActiuni): ReactElement {
  const router = useRouter();
  const [inCurs, porneste] = useTransition();
  const [deConfirmat, setDeConfirmat] = useState<"arhivare" | "reactivare" | "stergere" | null>(
    null,
  );
  const poateFiSters = !sablon.dePlatforma && sablon.nrEvaluari === 0;

  const executa = (
    apel: () => Promise<ActionResult<Readonly<{ id: string }>>>,
    mesaj: string,
    dupa?: (id: string) => void,
  ): void => {
    porneste(async () => {
      const rezultat = await apel();
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeConfirmat(null);
      arataToast({ fel: "reusita", text: mesaj });
      if (dupa === undefined) router.refresh();
      else dupa(rezultat.data.id);
    });
  };

  // Id-ul variantei create de „Personalizează”: editorul ei se montează
  // deschis. Cardul de platformă rămâne montat după `router.refresh()` (aceeași
  // cheie), deci starea supraviețuiește reîncărcării listei.
  const [variantaNoua, setVariantaNoua] = useState<string | null>(null);

  return (
    <>
      <BaraActiuni
        eticheta={`Acțiuni pentru „${sablon.denumire}”`}
        distructiva={
          sablon.dePlatforma ? undefined : (
            <>
              {sablon.activ ? (
                <Buton
                  varianta="distructiv"
                  disabled={inCurs}
                  onClick={() => {
                    setDeConfirmat("arhivare");
                  }}
                >
                  <Archive aria-hidden="true" className="size-3.5" />
                  Arhivează
                </Buton>
              ) : (
                <Buton
                  varianta="secundar"
                  disabled={inCurs}
                  onClick={() => {
                    setDeConfirmat("reactivare");
                  }}
                >
                  <ArchiveRestore aria-hidden="true" className="size-3.5" />
                  Reactivează
                </Buton>
              )}
              {poateFiSters ? (
                <Buton
                  varianta="distructiv"
                  disabled={inCurs}
                  onClick={() => {
                    setDeConfirmat("stergere");
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                  Șterge
                </Buton>
              ) : null}
            </>
          )
        }
      >
        {sablon.dePlatforma ? null : (
          <ConstructorSablon
            sablon={sablon}
            declansator={(deschide) => (
              <Buton varianta="secundar" onClick={deschide}>
                <Pencil aria-hidden="true" className="size-3.5" />
                Editează
              </Buton>
            )}
          />
        )}

        <Buton
          varianta={sablon.dePlatforma ? "primar" : "tertiar"}
          disabled={inCurs}
          onClick={() => {
            if (sablon.dePlatforma) {
              executa(
                () => duplicaSablonEvaluare({ id: sablon.id, denumire: sablon.denumire }),
                "Varianta firmei a fost creată. Modificați criteriile și salvați.",
                (id) => {
                  setVariantaNoua(id);
                  router.refresh();
                },
              );
              return;
            }
            executa(
              () =>
                duplicaSablonEvaluare({ id: sablon.id, denumire: denumireCopie(sablon.denumire) }),
              "Șablonul a fost duplicat.",
            );
          }}
        >
          <Copy aria-hidden="true" className="size-3.5" />
          {sablon.dePlatforma ? "Personalizează" : "Duplică"}
        </Buton>
      </BaraActiuni>

      {variantaNoua === null ? null : (
        <ConstructorSablon
          key={variantaNoua}
          sablon={{
            id: variantaNoua,
            denumire: sablon.denumire,
            descriere: sablon.descriere,
            criterii: sablon.criterii,
            versiune: 1,
            nrEvaluari: 0,
          }}
          deschideLaMontare
          // Fără buton propriu: varianta are, de acum, cardul ei cu „Editează”.
          declansator={() => <></>}
        />
      )}

      <ConfirmareActiune
        deschis={deConfirmat === "arhivare"}
        laInchidere={() => {
          setDeConfirmat(null);
        }}
        titlu={`Arhivați șablonul „${sablon.denumire}”?`}
        consecinta="Nu va mai putea fi ales la o evaluare nouă. Evaluările deja făcute pe el rămân neatinse, iar șablonul se poate reactiva oricând de aici."
        cifre={[
          { eticheta: "Criterii", valoare: String(sablon.criterii.length) },
          { eticheta: "Evaluări care îl folosesc", valoare: String(sablon.nrEvaluari) },
        ]}
        etichetaConfirmare="Arhivează"
        distructiv
        inCurs={inCurs}
        laConfirmare={() => {
          executa(
            () => arhiveazaSablonEvaluare({ id: sablon.id }),
            `Șablonul „${sablon.denumire}” a fost arhivat.`,
          );
        }}
      />

      <ConfirmareActiune
        deschis={deConfirmat === "stergere"}
        laInchidere={() => {
          setDeConfirmat(null);
        }}
        titlu={`Ștergeți șablonul „${sablon.denumire}”?`}
        consecinta="Șablonul dispare din listă și nu mai poate fi ales la o evaluare. Nu a fost folosit la nicio evaluare, deci nu se pierde nimic din istoric. Ștergerea nu se poate anula din aplicație."
        cifre={[{ eticheta: "Criterii", valoare: String(sablon.criterii.length) }]}
        etichetaConfirmare="Șterge"
        distructiv
        inCurs={inCurs}
        laConfirmare={() => {
          executa(
            () => stergeSablonEvaluare({ id: sablon.id }),
            `Șablonul „${sablon.denumire}” a fost șters.`,
          );
        }}
      />

      <ConfirmareActiune
        deschis={deConfirmat === "reactivare"}
        laInchidere={() => {
          setDeConfirmat(null);
        }}
        titlu={`Reactivați șablonul „${sablon.denumire}”?`}
        consecinta="Va reapărea în lista de șabloane care se pot alege la o evaluare nouă."
        etichetaConfirmare="Reactivează"
        inCurs={inCurs}
        laConfirmare={() => {
          executa(
            () => reactiveazaSablonEvaluare({ id: sablon.id }),
            `Șablonul „${sablon.denumire}” a fost reactivat.`,
          );
        }}
      />
    </>
  );
}
