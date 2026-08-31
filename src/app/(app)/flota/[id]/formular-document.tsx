"use client";

import { useCallback, useId, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

import { BaraActiuni } from "@/components/ui/bara-actiuni";
import { Buton } from "@/components/ui/buton";
import { Formular } from "@/components/ui/formular";
import type { TipDocument } from "@/lib/queries/fleet";

import { adaugaDocument } from "../actions";
import { CampuriDocument } from "./campuri-document";
import { valoriDocument } from "./valori-document";

/**
 * Adăugarea ȘI reînnoirea, în același panou.
 *
 * Nu există buton „Reînnoiește" și nici ecran separat: reînnoirea e o inserare
 * nouă, atât. Documentul vechi rămâne ca istoric, iar `internal.vdoc_dupa`
 * recalculează care e cel curent — cel cu `expira_la` maxim, nu ultimul
 * introdus. Un RCA cumpărat cu trei săptămâni înainte să expire cel vechi devine
 * curent imediat, fără ca cineva să bifeze ceva.
 *
 * ── DE CE RĂMÂNE ÎN PAGINĂ, CÂND CELELALTE DOUĂ AU DEVENIT CASETE ────────────
 * Vehiculul nou și foaia de parcurs se adaugă rar, de undeva din listă. Aici
 * ești deja pe fișa mașinii, cu tabelul scadențelor sub ochi, și completezi de
 * obicei mai multe documente unul după altul. Un panou deschis e exact ce
 * trebuie; o casetă ar cere trei clicuri în plus la fiecare rând.
 *
 * ── DE CE `key` PE FORMULAR ──────────────────────────────────────────────────
 * `Formular` reține `valoriTrimise` ca să nu piardă ce a scris omul când
 * acțiunea e refuzată. La REUȘITĂ, aceleași valori ar rămâne pe câmpuri, iar
 * următorul document ar porni cu emitentul poliței precedente. Remontarea prin
 * `key` golește starea; e mai ieftin decât un formular controlat.
 */
interface Proprietati {
  readonly vehiculId: string;
  readonly tipuri: readonly TipDocument[];
}

export function FormularDocument({ vehiculId, tipuri }: Proprietati): ReactElement {
  const router = useRouter();
  const idFormular = useId();
  const [generatie, setGeneratie] = useState(0);

  const idc = useCallback(
    (sufix: string): string => `${idFormular}-${String(generatie)}-${sufix}`,
    [idFormular, generatie],
  );

  const trimite = useCallback(
    async (date: FormData) => adaugaDocument({ vehicle_id: vehiculId, ...valoriDocument(date) }),
    [vehiculId],
  );

  const laReusita = useCallback((): void => {
    setGeneratie((g) => g + 1);
    router.refresh();
  }, [router]);

  return (
    <section
      aria-labelledby={`${idFormular}-titlu`}
      className="border-border rounded-panou border p-4"
    >
      <h3 id={`${idFormular}-titlu`} className="text-corp mb-3 font-semibold">
        Adaugă sau reînnoiește un document
      </h3>

      <Formular
        key={generatie}
        actiune={trimite}
        laReusita={laReusita}
        mesajReusita="Documentul a fost salvat."
      >
        {(stare) => (
          <>
            <CampuriDocument stare={stare} idc={idc} tipuri={tipuri} />
            <BaraActiuni aliniere="start">
              <Buton
                type="submit"
                varianta="primar"
                inCurs={stare.inCurs}
                textInCurs="Se salvează…"
              >
                Salvează documentul
              </Buton>
              <p className="text-muted-foreground text-nota">
                Reînnoirea se face tot de aici: documentul cu data de expirare cea mai îndepărtată
                devine automat cel curent.
              </p>
            </BaraActiuni>
          </>
        )}
      </Formular>
    </section>
  );
}
