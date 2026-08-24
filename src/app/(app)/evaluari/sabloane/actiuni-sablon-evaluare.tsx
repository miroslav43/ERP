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
 * ── DE CE ȘABLONUL DE PLATFORMĂ NU PRIMEȘTE „EDITEAZĂ" ────────────────────
 * Politica `evaluation_templates_update` cere `organization_id is not null`.
 * Un buton „Editează" pe el ar fi condamnat din construcție. În locul lui apare
 * „Personalizează", care duplică șablonul în firmă și deschide copia.
 */

import { Archive, ArchiveRestore, Copy, Pencil } from "lucide-react";
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
  const [deConfirmat, setDeConfirmat] = useState<"arhivare" | "reactivare" | null>(null);

  const executa = (
    apel: () => Promise<ActionResult<Readonly<{ id: string }>>>,
    mesaj: string,
  ): void => {
    porneste(async () => {
      const rezultat = await apel();
      if (!rezultat.ok) {
        arataToast({ fel: "eroare", text: rezultat.error.message });
        return;
      }
      setDeConfirmat(null);
      arataToast({ fel: "reusita", text: mesaj });
      router.refresh();
    });
  };

  return (
    <>
      <BaraActiuni
        eticheta={`Acțiuni pentru „${sablon.denumire}”`}
        distructiva={
          sablon.dePlatforma ? undefined : sablon.activ ? (
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
            executa(
              () =>
                duplicaSablonEvaluare({ id: sablon.id, denumire: denumireCopie(sablon.denumire) }),
              sablon.dePlatforma
                ? "Copia a fost creată în firma dumneavoastră. O puteți edita acum."
                : "Șablonul a fost duplicat.",
            );
          }}
        >
          <Copy aria-hidden="true" className="size-3.5" />
          {sablon.dePlatforma ? "Personalizează" : "Duplică"}
        </Buton>
      </BaraActiuni>

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
